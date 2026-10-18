import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { PrismaService } from './prisma.service';
import { phoneSchema, reauthVerifySchema, type ReauthResponse } from '@raahi/contracts';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;
const appleEncryptionKey = () => createHash('sha256').update(`raahi:apple-refresh:${process.env.APPLE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || ''}`).digest();
export function encryptAppleRefreshToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', appleEncryptionKey(), iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}
export function decryptAppleRefreshToken(value: string) {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid Apple token envelope.');
  const decipher = createDecipheriv('aes-256-gcm', appleEncryptionKey(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
export function recentAuthenticationSeconds(session: { createdAt: Date; reauthenticatedAt: Date | null }, now = Date.now()) {
  const age = now - (session.reauthenticatedAt || session.createdAt).valueOf();
  return age >= 0 && age < REAUTH_WINDOW_MS ? Math.ceil((REAUTH_WINDOW_MS - age) / 1000) : 0;
}
export type AuthedRequest = { userId: string; sessionId: string; headers: { authorization?: string } };

@Injectable()
export class AuthService {
  private readonly appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  constructor(private db: PrismaService, private jwt: JwtService) {}
  async requestOtp(input: unknown) {
    const result = phoneSchema.safeParse(input);
    if (!result.success) throw new BadRequestException(result.error.issues[0].message);
    const phone = result.data;
    const recent = await this.db.otpChallenge.findUnique({ where: { phone } });
    if (recent && Date.now() - recent.updatedAt.valueOf() < 60000) throw new BadRequestException('Wait a minute before requesting another code.');
    const code = String(randomInt(100000, 1000000));
    await this.db.otpChallenge.upsert({ where: { phone }, create: { phone, hash: hash(code), expiresAt: new Date(Date.now() + 300000) }, update: { hash: hash(code), attempts: 0, expiresAt: new Date(Date.now() + 300000) } });
    if (process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production') return { expiresIn: 300, devCode: code };
    await this.twilio('Verifications', { To: phone, Channel: 'sms' });
    return { expiresIn: 300 };
  }
  private async twilio(path: string, fields: Record<string, string>) {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_VERIFY_SERVICE_SID: service } = process.env;
    if (!sid || !token || !service) throw new BadRequestException('SMS authentication is not configured.');
    let response: Response;
    try { response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) }); }
    catch { throw new BadRequestException('SMS verification is taking too long. Retry in a moment.'); }
    if (!response.ok) throw new BadRequestException('SMS verification failed. Please try again.');
    return response.json() as Promise<{ status: string; sid: string }>;
  }
  async verifyOtp(phoneInput: unknown, code: unknown) {
    const parsed = phoneSchema.safeParse(phoneInput);
    if (!parsed.success || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new BadRequestException('Enter your phone number and six-digit code.');
    const phone = parsed.data;
    await this.consumeOtp(phone, code);
    const user = await this.db.user.upsert({ where: { phone }, create: { phone, verified: true }, update: { verified: true } });
    return this.session(user.id);
  }
  private async consumeOtp(phone: string, code: string) {
    const challenge = await this.db.otpChallenge.findUnique({ where: { phone } });
    if (!challenge || challenge.expiresAt.valueOf() < Date.now() || challenge.attempts >= 5) throw new UnauthorizedException('Code expired. Request a new one.');
    await this.db.otpChallenge.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    const approved = process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production'
      ? hash(code) === challenge.hash : (await this.twilio('VerificationCheck', { To: phone, Code: code })).status === 'approved';
    if (!approved) throw new UnauthorizedException('That code is incorrect.');
    const consumed = await this.db.otpChallenge.deleteMany({ where: { phone, hash: challenge.hash } });
    if (consumed.count !== 1) throw new UnauthorizedException('This code was already used.');
  }
  private reauthHash(sessionId: string, code: string) {
    return createHmac('sha256', process.env.JWT_SECRET!).update(`reauth:${sessionId}:${code}`).digest('hex');
  }
  async requestReauth(userId: string, sessionId: string): Promise<ReauthResponse> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'reauth-user:' + userId}))`;
      const session = await tx.session.findUnique({ where: { id: sessionId }, include: { user: { select: { phone: true, appleId: true } } } });
      if (!session || session.userId !== userId || session.expiresAt.valueOf() <= Date.now()) throw new UnauthorizedException('Session expired. Sign in again.');
      const expiresIn = recentAuthenticationSeconds(session);
      if (expiresIn) return { method: 'recent', alreadyVerified: true, expiresIn };
      const previous = await tx.reauthChallenge.findUnique({ where: { sessionId } });
      if (previous && Date.now() - previous.sentAt.valueOf() < 60000) throw new BadRequestException('Wait a minute before requesting another verification.');
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.valueOf() + 300000);
      if (session.user.phone) {
        // Verify providers can reuse an active SMS code for the same phone.
        // Only one session may hold an active phone challenge for this account.
        const other = await tx.reauthChallenge.findFirst({ where: { method: 'phone', sessionId: { not: sessionId }, session: { userId }, expiresAt: { gt: new Date() } } });
        if (other) throw new BadRequestException('A verification is active in another session. Finish it there or wait five minutes before retrying here.');
        const code = String(randomInt(100000, 1000000));
        const development = process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production';
        const verification = development ? null : await this.twilio('Verifications', { To: session.user.phone, Channel: 'sms' });
        const data = { method: 'phone', hash: this.reauthHash(sessionId, code), providerSid: verification?.sid || null, attempts: 0, sentAt, expiresAt };
        await tx.reauthChallenge.upsert({ where: { sessionId }, create: { sessionId, ...data }, update: data });
        return { method: 'phone', hint: `number ending ${session.user.phone.slice(-4)}`, expiresIn: 300, retryAfter: 60, ...(development ? { devCode: code } : {}) };
      }
      if (!session.user.appleId) throw new BadRequestException('No sign-in method is available. Contact support for account recovery.');
      const nonce = randomBytes(32).toString('hex');
      const data = { method: 'apple', hash: hash(nonce), providerSid: null, attempts: 0, sentAt, expiresAt };
      await tx.reauthChallenge.upsert({ where: { sessionId }, create: { sessionId, ...data }, update: data });
      return { method: 'apple', nonce, expiresIn: 300 };
    }, { timeout: 20000 });
  }
  async verifyReauth(userId: string, sessionId: string, body: unknown) {
    const parsed = reauthVerifySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Enter the verification code or confirm with Apple.');
    const input = parsed.data;
    const challenge = await this.db.reauthChallenge.findUnique({ where: { sessionId }, include: { session: { include: { user: { select: { appleId: true } } } } } });
    if (!challenge || challenge.session.userId !== userId || challenge.session.expiresAt.valueOf() <= Date.now()) throw new BadRequestException('Request a fresh verification from this session.');
    if (challenge.method !== ('code' in input ? 'phone' : 'apple')) throw new BadRequestException('Use this account’s original sign-in method.');
    // Reserve an attempt atomically so concurrent failures cannot exceed the limit.
    const attempt = await this.db.reauthChallenge.updateMany({ where: { sessionId, hash: challenge.hash, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    if (attempt.count !== 1) throw new BadRequestException('Verification expired or too many attempts. Request a new verification.');
    if ('code' in input) {
      const approved = process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production'
        ? this.reauthHash(sessionId, input.code) === challenge.hash
        : Boolean(challenge.providerSid) && (await this.twilio('VerificationCheck', { VerificationSid: challenge.providerSid!, Code: input.code })).status === 'approved';
      if (!approved) throw new BadRequestException('That code is incorrect. Check the code and retry.');
    } else {
      const claims = await this.verifyAppleIdentity(input.identityToken);
      if (claims.sub !== challenge.session.user.appleId || typeof claims.nonce !== 'string' || hash(claims.nonce) !== challenge.hash) throw new BadRequestException('Confirm with the same Apple account using a fresh verification.');
    }
    await this.db.$transaction(async (tx) => {
      const consumed = await tx.reauthChallenge.deleteMany({ where: { sessionId, hash: challenge.hash, expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) throw new BadRequestException('This verification was already used or expired. Request a new one.');
      const updated = await tx.session.updateMany({ where: { id: sessionId, userId, expiresAt: { gt: new Date() } }, data: { reauthenticatedAt: new Date() } });
      if (updated.count !== 1) throw new UnauthorizedException('Session expired. Sign in again.');
    });
    return { ok: true as const };
  }
  async requireRecentAuthentication(userId: string, sessionId: string) {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.expiresAt.valueOf() <= Date.now()) throw new UnauthorizedException('Session expired. Sign in again.');
    if (!recentAuthenticationSeconds(session)) throw new ForbiddenException({ code: 'REAUTH_REQUIRED', message: 'Confirm your identity again before this sensitive action.' });
  }
  private async verifyAppleIdentity(identityToken: unknown) {
    if (typeof identityToken !== 'string' || !process.env.APPLE_CLIENT_ID) throw new BadRequestException('Apple Sign In is not configured.');
    try { return (await jwtVerify(identityToken, this.appleKeys, { issuer: 'https://appleid.apple.com', audience: process.env.APPLE_CLIENT_ID })).payload; }
    catch { throw new BadRequestException('Apple verification failed. Confirm with Apple again.'); }
  }
  private appleCredentialsConfigured() {
    return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY && process.env.APPLE_TOKEN_ENCRYPTION_KEY);
  }
  private async appleClientSecret() {
    if (!this.appleCredentialsConfigured()) throw new BadRequestException('Apple account linking is not configured.');
    try {
      const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
      return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! }).setIssuer(process.env.APPLE_TEAM_ID!).setSubject(process.env.APPLE_CLIENT_ID!).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('180d').sign(key);
    } catch { throw new BadRequestException('Apple account linking is not configured correctly.'); }
  }
  private async exchangeAppleAuthorizationCode(code: string) {
    if (!this.appleCredentialsConfigured()) {
      if (process.env.NODE_ENV === 'production') throw new BadRequestException('Apple account linking is not configured.');
      return null;
    }
    const clientSecret = await this.appleClientSecret(); let response: Response;
    try {
      response = await fetch('https://appleid.apple.com/auth/token', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID!, client_secret: clientSecret, code, grant_type: 'authorization_code' }) });
    } catch { throw new BadRequestException('Apple verification is taking too long. Retry in a moment.'); }
    if (!response.ok) throw new BadRequestException('Apple verification failed. Retry with Apple.');
    const data = await response.json() as { refresh_token?: string };
    if (!data.refresh_token) throw new BadRequestException('Apple did not return a revocable account token. Retry with Apple.');
    return encryptAppleRefreshToken(data.refresh_token);
  }
  async apple(identityToken: unknown, authorizationCode?: unknown) {
    const subject = (await this.verifyAppleIdentity(identityToken)).sub;
    if (!subject) throw new UnauthorizedException();
    const encryptedToken = typeof authorizationCode === 'string' && authorizationCode.length > 0 ? await this.exchangeAppleAuthorizationCode(authorizationCode) : null;
    const user = await this.db.user.upsert({ where: { appleId: subject }, create: { appleId: subject, verified: true, ...(encryptedToken ? { appleRefreshTokenEncrypted: encryptedToken } : {}) }, update: { verified: true, ...(encryptedToken ? { appleRefreshTokenEncrypted: encryptedToken } : {}) } });
    return this.session(user.id);
  }
  async revokeAppleToken(encryptedToken: string | null | undefined) {
    if (!encryptedToken) return;
    let token: string;
    try { token = decryptAppleRefreshToken(encryptedToken); } catch { throw new BadRequestException('Apple account access could not be verified yet. Retry account deletion.'); }
    const clientSecret = await this.appleClientSecret(); let response: Response;
    try {
      response = await fetch('https://appleid.apple.com/auth/revoke', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID!, client_secret: clientSecret, token, token_type_hint: 'refresh_token' }) });
    } catch { throw new BadRequestException('Apple account access could not be revoked yet. Retry account deletion.'); }
    if (!response.ok) throw new BadRequestException('Apple account access could not be revoked yet. Retry account deletion.');
  }
  async handleAppleNotification(signedPayload: unknown) {
    if (typeof signedPayload !== 'string' || signedPayload.length > 20000) throw new BadRequestException('Invalid Apple notification.');
    let payload;
    try { payload = (await jwtVerify(signedPayload, this.appleKeys, { issuer: 'https://appleid.apple.com', audience: process.env.APPLE_CLIENT_ID })).payload; }
    catch { throw new BadRequestException('Apple notification verification failed.'); }
    const event = payload.events;
    if (!event || typeof event !== 'object' || typeof (event as { type?: unknown }).type !== 'string' || typeof (event as { sub?: unknown }).sub !== 'string') throw new BadRequestException('Invalid Apple notification payload.');
    const type = (event as { type: string }).type; const subject = (event as { sub: string }).sub;
    if (type === 'consent-revoked' || type === 'account-deleted') {
      const user = await this.db.user.findUnique({ where: { appleId: subject }, select: { id: true, phone: true } });
      if (user) await this.db.user.update({ where: { id: user.id }, data: { appleId: null, appleRefreshTokenEncrypted: null, ...(user.phone ? {} : { verified: false }) } });
    }
    return { ok: true as const };
  }
  private async session(userId: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.db.session.create({ data: { userId, hash: hash(refreshToken), expiresAt: new Date(Date.now() + 14 * 86400000) } });
    return { accessToken: await this.jwt.signAsync({ sub: userId, sid: session.id }), refreshToken, userId };
  }
  async refresh(token: unknown) {
    if (typeof token !== 'string') throw new UnauthorizedException();
    const session = await this.db.session.findUnique({ where: { hash: hash(token) } });
    if (!session || session.expiresAt.valueOf() < Date.now()) throw new UnauthorizedException('Session expired. Sign in again.');
    const refreshToken = randomBytes(48).toString('base64url');
    const updated = await this.db.session.updateMany({ where: { id: session.id, hash: hash(token) }, data: { hash: hash(refreshToken) } });
    if (updated.count !== 1) throw new UnauthorizedException('Session was already refreshed.');
    return { accessToken: await this.jwt.signAsync({ sub: session.userId, sid: session.id }), refreshToken, userId: session.userId };
  }
  async authenticate(token: string) {
    return (await this.authenticateSession(token)).userId;
  }
  async authenticateSession(token: string) {
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token);
      const session = await this.db.session.findUnique({ where: { id: claims.sid } });
      if (!session || session.userId !== claims.sub || session.expiresAt.valueOf() < Date.now()) throw new Error();
      return { userId: claims.sub, sessionId: session.id };
    } catch { throw new UnauthorizedException('Please sign in again.'); }
  }
  async logout(token: unknown) { if (typeof token === 'string') await this.db.session.deleteMany({ where: { hash: hash(token) } }); }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    const session = await this.auth.authenticateSession(header.slice(7));
    request.userId = session.userId;
    request.sessionId = session.sessionId;
    return true;
  }
}
