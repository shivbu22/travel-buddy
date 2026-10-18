import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthService } from '../src/auth';

const run = process.env.RUN_DB_TESTS === '1';
if (run && !new URL(process.env.DATABASE_URL || '').pathname.includes('_test')) throw new Error('Reauth tests require a disposable _test database.');
const db = new PrismaClient();
const auth = new AuthService(db as never, new JwtService({ secret: 'test-only-reauth-secret-of-sufficient-length' }));
const created: string[] = [];
const environment = { JWT_SECRET: process.env.JWT_SECRET, AUTH_MODE: process.env.AUTH_MODE, APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID };
const old = () => new Date(Date.now() - 660000);
async function fixture(apple = false) {
  const user = await db.user.create({ data: apple ? { appleId: randomUUID() } : { phone: `+919${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}` } });
  created.push(user.id);
  const session = await db.session.create({ data: { userId: user.id, hash: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 86400000), createdAt: old() } });
  return { user, session };
}

describe.skipIf(!run)('session-bound reauthentication', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-only-reauth-secret-of-sufficient-length'; process.env.AUTH_MODE = 'development'; process.env.APPLE_CLIENT_ID = 'com.raahi.test'; });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: created } } }); await db.$disconnect();
    for (const [key, value] of Object.entries(environment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  it('rejects login codes, expires challenges, and enforces five attempts under concurrent requests', async () => {
    const { user, session } = await fixture();
    await auth.requestOtp(user.phone!);
    const requested = await auth.requestReauth(user.id, session.id);
    expect(requested.method).toBe('phone');
    if (requested.method !== 'phone' || !requested.devCode) throw new Error('Expected development code');
    const wrong = requested.devCode === '000000' ? '000001' : '000000';
    await expect(auth.verifyReauth(user.id, session.id, { code: wrong })).rejects.toThrow('incorrect');
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => auth.verifyReauth(user.id, session.id, { code: wrong })));
    expect(attempts.every((result) => result.status === 'rejected')).toBe(true);
    expect((await db.reauthChallenge.findUniqueOrThrow({ where: { sessionId: session.id } })).attempts).toBe(5);
    await expect(auth.verifyReauth(user.id, session.id, { code: requested.devCode })).rejects.toThrow('too many attempts');
    await db.reauthChallenge.update({ where: { sessionId: session.id }, data: { attempts: 0, expiresAt: new Date(Date.now() - 1) } });
    await expect(auth.verifyReauth(user.id, session.id, { code: requested.devCode })).rejects.toThrow('expired');
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).reauthenticatedAt).toBeNull();
    await db.otpChallenge.deleteMany({ where: { phone: user.phone! } });
  });
  it('keeps reauthentication separate from login and rejects resend/request races', async () => {
    const { user, session } = await fixture();
    const otherSession = await db.session.create({ data: { userId: user.id, hash: randomUUID(), expiresAt: new Date(Date.now() + 86400000), createdAt: old() } });
    const results = await Promise.allSettled([1, 2].map(() => auth.requestReauth(user.id, session.id)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const accepted = results.find((result) => result.status === 'fulfilled');
    if (!accepted || accepted.status !== 'fulfilled' || accepted.value.method !== 'phone') throw new Error('Expected phone challenge');
    await expect(auth.verifyOtp(user.phone, accepted.value.devCode)).rejects.toThrow('expired');
    await expect(auth.verifyReauth(user.id, otherSession.id, { code: accepted.value.devCode })).rejects.toThrow('this session');
    await expect(auth.requestReauth(user.id, otherSession.id)).rejects.toThrow('another session');
    await auth.verifyReauth(user.id, session.id, { code: accepted.value.devCode });
    await expect(auth.requireRecentAuthentication(user.id, session.id)).resolves.toBeUndefined();
    await expect(auth.requireRecentAuthentication(user.id, otherSession.id)).rejects.toThrow('Confirm your identity');
    const rotated = await auth.requestReauth(user.id, session.id); expect(rotated.method).toBe('recent');
  });
  it('verifies signed Apple identity, same-account nonce binding, and one-time consumption', async () => {
    const { user, session } = await fixture(true);
    const requested = await auth.requestReauth(user.id, session.id);
    if (requested.method !== 'apple') throw new Error('Expected Apple nonce');
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey); jwk.kid = 'test-apple'; jwk.alg = 'RS256';
    // Replace only the provider's key source; JWT signature/audience/issuer verification stays real.
    (auth as unknown as { appleKeys: JWTVerifyGetKey }).appleKeys = createLocalJWKSet({ keys: [jwk] });
    const token = (sub: string, nonce: string) => new SignJWT({ nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-apple' }).setSubject(sub).setIssuer('https://appleid.apple.com').setAudience('com.raahi.test').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    await expect(auth.verifyReauth(user.id, session.id, { identityToken: await token('wrong-account', requested.nonce) })).rejects.toThrow('same Apple account');
    await expect(auth.verifyReauth(user.id, session.id, { identityToken: await token(user.appleId!, 'old-nonce') })).rejects.toThrow('fresh verification');
    await expect(auth.verifyReauth(user.id, session.id, { identityToken: 'unsigned-token' })).rejects.toThrow('Apple verification failed');
    const correct = await token(user.appleId!, requested.nonce);
    await expect(auth.verifyReauth(user.id, session.id, { identityToken: correct })).resolves.toEqual({ ok: true });
    await expect(auth.verifyReauth(user.id, session.id, { identityToken: correct })).rejects.toThrow('fresh verification');
    await expect(auth.requireRecentAuthentication(user.id, session.id)).resolves.toBeUndefined();
    await db.session.update({ where: { id: session.id }, data: { reauthenticatedAt: old() } });
    await expect(auth.requireRecentAuthentication(user.id, session.id)).rejects.toThrow('Confirm your identity');
    const notification = await new SignJWT({ events: { type: 'consent-revoked', sub: user.appleId, event_time: Date.now() } }).setProtectedHeader({ alg: 'RS256', kid: 'test-apple' }).setIssuer('https://appleid.apple.com').setAudience('com.raahi.test').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    await expect(auth.handleAppleNotification(notification)).resolves.toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).appleId).toBeNull();
  });
});
