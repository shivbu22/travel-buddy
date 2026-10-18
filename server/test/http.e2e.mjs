import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { JwtService } from '@nestjs/jwt';

if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) throw new Error('HTTP tests require a disposable DATABASE_URL whose database name contains _test.');
const media = await mkdtemp(join(tmpdir(), 'raahi-http-'));
Object.assign(process.env, { NODE_ENV: 'test', AUTH_MODE: 'development', JWT_SECRET: randomBytes(40).toString('hex'), ADMIN_TOKEN: randomBytes(40).toString('hex'), UPLOAD_DIR: join(media, 'photos'), VERIFICATION_DIR: join(media, 'selfies'), CLIENT_ORIGIN: 'https://allowed.example' });
const { createApplication } = await import('../dist/application.js');
const { PrismaService } = await import('../dist/prisma.service.js');
let app, db, base;
const sessions = [];
let photoBytes;

async function call(path, token, method = 'GET', body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/v1${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data, headers: response.headers };
}
function image(bytes = photoBytes) {
  const form = new FormData(); form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg'); return form;
}
async function account(approved = false) {
  const phone = `+919${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}`;
  const requested = await call('/auth/otp/request', null, 'POST', { phone }); assert.equal(requested.status, 201);
  const verified = await call('/auth/otp/verify', null, 'POST', { phone, code: requested.data.devCode }); assert.equal(verified.status, 201);
  const session = { ...verified.data, phone, code: requested.data.devCode }; sessions.push(session);
  if (approved) await db.user.update({ where: { id: session.userId }, data: { name: 'Test traveler', onboarded: true, verificationStatus: 'APPROVED' } });
  return session;
}
async function reauth(session) {
  const requested = await call('/auth/reauth/request', session.accessToken, 'POST'); assert.equal(requested.status, 201);
  if (requested.data.alreadyVerified) return;
  assert.ok(requested.data.devCode);
  const verified = await call('/auth/reauth/verify', session.accessToken, 'POST', { code: requested.data.devCode }); assert.equal(verified.status, 201);
}
before(async () => {
  app = await createApplication(true); await app.listen(0, '127.0.0.1'); base = await app.getUrl(); process.env.PUBLIC_URL = base;
  db = app.get(PrismaService);
  photoBytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#E1037D' } }).jpeg().toBuffer();
});
after(async () => {
  for (const session of sessions) {
    await db.match.deleteMany({ where: { OR: [{ userAId: session.userId }, { userBId: session.userId }] } });
    await db.interest.deleteMany({ where: { OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] } });
    await db.pass.deleteMany({ where: { OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] } });
    await db.report.deleteMany({ where: { OR: [{ reporterId: session.userId }, { reportedUserId: session.userId }] } });
    await db.block.deleteMany({ where: { OR: [{ blockerId: session.userId }, { blockedId: session.userId }] } });
    await db.deviceToken.deleteMany({ where: { userId: session.userId } });
    await db.otpChallenge.deleteMany({ where: { phone: session.phone } });
    await db.user.deleteMany({ where: { id: session.userId } });
  }
  await app?.close(); await rm(media, { recursive: true, force: true });
});

test('headers, CORS, admin protection, OTP replay and rotating sessions', async () => {
  const health = await call('/health'); assert.equal(health.status, 200); assert.equal(health.data.database, 'ok'); assert.equal(health.data.production, false); assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  const origin = await fetch(`${base}/v1/health`, { headers: { Origin: 'https://evil.example' } }); assert.equal(origin.headers.get('access-control-allow-origin'), null);
  const goodOrigin = await fetch(`${base}/v1/health`, { headers: { Origin: 'https://allowed.example' } }); assert.equal(goodOrigin.headers.get('access-control-allow-origin'), 'https://allowed.example');
  assert.equal((await call('/me')).status, 401); assert.equal((await call('/admin/verifications')).status, 403);
  const user = await account();
  assert.equal((await call('/auth/otp/verify', null, 'POST', { phone: user.phone, code: user.code })).status, 401);
  const rotated = await call('/auth/refresh', null, 'POST', { refreshToken: user.refreshToken }); assert.equal(rotated.status, 201);
  assert.equal((await call('/auth/refresh', null, 'POST', { refreshToken: user.refreshToken })).status, 401);
  await call('/auth/logout', null, 'POST', { refreshToken: rotated.data.refreshToken });
  assert.equal((await call('/me', rotated.data.accessToken)).status, 401);
});

test('real image processing, corrupt-file rejection, selfie privacy and deletion', async () => {
  const user = await account();
  const other = await account();
  assert.equal((await call('/me/photos', user.accessToken, 'POST', image(Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex')))).status, 400);
  let uploaded;
  for (let i = 0; i < 3; i++) { uploaded = await call('/me/photos', user.accessToken, 'POST', image()); assert.equal(uploaded.status, 201); }
  const returned = await fetch(uploaded.data.photos[0]); assert.equal(returned.status, 200);
  assert.equal((await sharp(Buffer.from(await returned.arrayBuffer())).metadata()).format, 'jpeg');
  const selfie = await call('/verification/selfie', user.accessToken, 'POST', image()); assert.equal(selfie.status, 201);
  const record = await db.user.findUniqueOrThrow({ where: { id: user.userId } });
  assert.equal((await fetch(`${base}/uploads/${record.verificationKey}`)).status, 404);
  assert.equal((await call('/me/location', user.accessToken, 'PUT', { latitude: 19.07, longitude: 72.87, accuracy: 10, city: 'Mumbai', neighborhood: '' })).status, 200);
  const post = await db.post.create({ data: { userId: user.userId, caption: 'Mumbai monsoon', city: 'Mumbai', country: 'India' } });
  await db.postComment.create({ data: { postId: post.id, userId: other.userId, body: 'Other traveler comment' } });
  await db.session.updateMany({ where: { userId: user.userId }, data: { createdAt: new Date(Date.now() - 11 * 60 * 1000), reauthenticatedAt: null } });
  assert.equal((await call('/account/export', user.accessToken)).status, 403);
  await reauth(user);
  const exported = await call('/account/export', user.accessToken); assert.equal(exported.status, 200);
  assert.equal(JSON.stringify(exported.data).includes(user.refreshToken), false);
  assert.equal(exported.data.posts[0].comments, undefined);
  assert.deepEqual(exported.data.comments, []);
   const deleted = await call('/account', user.accessToken, 'DELETE', { confirmation: 'DELETE' }); assert.equal(deleted.status, 200);
  assert.equal((await call('/me', user.accessToken)).status, 401);
  await assert.rejects(access(join(process.env.VERIFICATION_DIR, record.verificationKey)));
  await assert.rejects(access(join(process.env.UPLOAD_DIR, basename(uploaded.data.photos[0]))));
  assert.equal(await db.userLocation.count({ where: { userId: user.userId } }), 0);
});

test('Journal ownership, stable same-time pagination, idempotent likes and block filtering', async () => {
  const a = await account(true), b = await account(true), c = await account(true);
  const stamp = new Date('2035-01-01T00:00:00Z');
  await db.post.createMany({ data: Array.from({ length: 45 }, () => ({ id: randomUUID(), userId: a.userId, caption: 'जयपुर ☕', city: 'Jaipur', country: 'India', createdAt: stamp })) });
  const first = await call('/posts/feed', b.accessToken); assert.equal(first.data.items.length, 20);
  const second = await call(`/posts/feed?cursor=${first.data.nextCursor}`, b.accessToken);
  const third = await call(`/posts/feed?cursor=${second.data.nextCursor}`, b.accessToken);
  const ids = [...first.data.items, ...second.data.items, ...third.data.items].map((post) => post.id);
  assert.equal(new Set(ids).size, 45); assert.equal(third.data.nextCursor, null);
  const id = first.data.items[0].id;
  assert.equal((await call(`/posts/${id}`, b.accessToken, 'DELETE')).status, 404);
  for (let i = 0; i < 2; i++) assert.deepEqual((await call(`/posts/${id}/like`, b.accessToken, 'POST', { liked: true })).data, { liked: true, likeCount: 1 });
  assert.equal((await call(`/posts/${id}/comments`, b.accessToken, 'POST', { body: '   ' })).status, 400);
  const comment = await call(`/posts/${id}/comments`, b.accessToken, 'POST', { body: 'Nice chai stop ☕' }); assert.equal(comment.status, 201);
  await call(`/safety/block/${b.userId}`, c.accessToken, 'POST');
  const hiddenComment = await call('/posts/feed', c.accessToken); assert.equal(hiddenComment.data.items.find((p) => p.id === id).comments.length, 0);
  await call(`/safety/block/${b.userId}`, a.accessToken, 'POST');
  assert.equal((await call('/posts/feed', b.accessToken)).data.items.length, 0);
  assert.equal((await call(`/posts/${id}/comments`, b.accessToken, 'POST', { body: 'Blocked attempt' })).status, 404);
  assert.equal((await call(`/posts/${id}/like`, b.accessToken, 'POST', { liked: true })).status, 404);
});

test('account export includes own records without incoming private actions, other authors or credentials', async () => {
  const a = await account(), b = await account(), c = await account();
  const ownSelfieKey = `private-selfie-${randomUUID()}.jpg`;
  await db.user.update({ where: { id: a.userId }, data: { verificationKey: ownSelfieKey, location: { create: { latitude: 19.07, longitude: 72.87, accuracy: 10, city: 'Mumbai' } } } });
  await db.user.update({ where: { id: b.userId }, data: { location: { create: { latitude: 26.91, longitude: 75.78, city: 'Jaipur' } } } });
  const makeTrip = (userId) => db.trip.create({ data: { userId, city: 'Kochi', country: 'India', key: 'kochi|india', start: new Date('2035-01-01'), end: new Date('2035-01-10'), budgetMin: 5000, budgetMax: 10000, styles: ['Food'], description: 'A test trip.' } });
  const [ownTrip, otherTrip] = await Promise.all([makeTrip(a.userId), makeTrip(b.userId)]);
  const ownPost = await db.post.create({ data: { userId: a.userId, caption: 'My trip', city: 'Kochi', country: 'India', media: { create: { key: 'own-public-photo.jpg', sortOrder: 0 } } } });
  const otherPost = await db.post.create({ data: { userId: b.userId, caption: 'Other author post', city: 'Jaipur', country: 'India' } });
  const ownComment = await db.postComment.create({ data: { postId: otherPost.id, userId: a.userId, body: 'My comment on another post' } });
  await db.postComment.create({ data: { postId: ownPost.id, userId: b.userId, body: 'Other author comment on my post' } });
  await db.postLike.createMany({ data: [{ postId: otherPost.id, userId: a.userId }, { postId: ownPost.id, userId: b.userId }] });
   const ownInterest = await db.interest.create({ data: { fromUserId: a.userId, toUserId: b.userId, tripId: otherTrip.id, kind: 'normal', comment: 'My interest', targetText: 'Other author prompt snapshot', dismissedAt: new Date() } });
  await db.interest.createMany({ data: [
    { fromUserId: b.userId, toUserId: a.userId, tripId: ownTrip.id, kind: 'normal', comment: 'Incoming private interest' },
    { fromUserId: c.userId, toUserId: b.userId, tripId: otherTrip.id, kind: 'normal', comment: 'Unrelated private interest' },
  ] });
  await db.pass.createMany({ data: [{ fromUserId: a.userId, toUserId: b.userId }, { fromUserId: b.userId, toUserId: a.userId }, { fromUserId: c.userId, toUserId: b.userId }] });
  await db.block.createMany({ data: [{ blockerId: a.userId, blockedId: c.userId }, { blockerId: b.userId, blockedId: a.userId }, { blockerId: c.userId, blockedId: b.userId }] });
  const ownReport = await db.report.create({ data: { reporterId: a.userId, reportedUserId: b.userId, reason: 'Other', details: 'My submitted report' } });
  await db.report.createMany({ data: [
    { reporterId: b.userId, reportedUserId: a.userId, reason: 'Other', details: 'Incoming private report' },
    { reporterId: c.userId, reportedUserId: b.userId, reason: 'Other', details: 'Unrelated private report' },
  ] });
  const ownReadAt = new Date('2035-01-02T00:00:00Z');
  const makeMatch = (userAId, userBId, tripId) => db.match.create({ data: {
    pairKey: randomUUID(), userAId, userBId, tripId,
    messages: { create: [
      { senderId: userAId, clientId: randomUUID(), body: userAId === a.userId ? 'My sent message' : 'Unrelated conversation message' },
      { senderId: userBId, clientId: randomUUID(), body: 'Other author message' },
    ] },
    reads: { create: [{ userId: userAId, lastReadAt: ownReadAt }, { userId: userBId, lastReadAt: new Date('2035-01-03T00:00:00Z') }] },
  } });
  const ownMatch = await makeMatch(a.userId, b.userId, ownTrip.id);
  await makeMatch(b.userId, c.userId, otherTrip.id);
  const pushToken = `ExpoPushToken[${randomUUID()}]`;
  await db.deviceToken.createMany({ data: [{ userId: a.userId, token: pushToken, enabled: false }, { userId: b.userId, token: `ExpoPushToken[${randomUUID()}]`, enabled: true }] });
   const ownSession = await db.session.findFirstOrThrow({ where: { userId: a.userId } });
   const oldSessionCreatedAt = new Date(Date.now() - 11 * 60 * 1000);
   await db.session.update({ where: { id: ownSession.id }, data: { createdAt: oldSessionCreatedAt, reauthenticatedAt: null } });
   ownSession.createdAt = oldSessionCreatedAt;

   assert.equal((await call('/account/export')).status, 401);
   assert.equal((await call('/account/export', 'invalid-token')).status, 401);
   assert.equal((await call(`/account/export?userId=${b.userId}`, a.accessToken)).status, 403);
   await reauth(a);
   const exported = await call(`/account/export?userId=${b.userId}`, a.accessToken);
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('cache-control'), 'no-store');
  const data = exported.data;
  assert.equal(data.account.id, a.userId);
  assert.equal(data.account.phone, a.phone);
  assert.equal(data.account.location.latitude, 19.07);
  assert.equal(data.account.location.longitude, 72.87);
  assert.deepEqual(data.account.sessions, [{ id: ownSession.id, createdAt: ownSession.createdAt.toISOString(), expiresAt: ownSession.expiresAt.toISOString() }]);
  assert.deepEqual(data.trips.map((trip) => trip.id), [ownTrip.id]);
  assert.deepEqual(data.posts.map((post) => post.id), [ownPost.id]);
  assert.deepEqual(data.posts[0].media, [{ key: 'own-public-photo.jpg', sortOrder: 0 }]);
  assert.equal(data.posts[0].comments, undefined);
  assert.equal(data.posts[0].likes, undefined);
  assert.deepEqual(data.comments.map((comment) => comment.id), [ownComment.id]);
  assert.equal(data.comments[0].body, ownComment.body);
  assert.deepEqual(data.likes.map((like) => like.postId), [otherPost.id]);
   assert.deepEqual(data.interests.map((interest) => interest.id), [ownInterest.id]);
   assert.equal('dismissedAt' in data.interests[0], false, 'The recipient’s private pass decision must not be exported to the sender');
   assert.equal('targetText' in data.interests[0], false, 'Another author’s prompt snapshot must not be included');
  assert.deepEqual(data.passes, [{ fromUserId: a.userId, toUserId: b.userId }]);
  assert.deepEqual(data.blocks.map(({ blockerId, blockedId }) => ({ blockerId, blockedId })), [{ blockerId: a.userId, blockedId: c.userId }]);
  assert.deepEqual(data.reports.map((report) => report.id), [ownReport.id]);
  assert.deepEqual(data.matches.map((match) => match.id), [ownMatch.id]);
  assert.deepEqual(data.matches[0].messages.map((message) => message.body), ['My sent message']);
  assert.deepEqual(data.matches[0].reads, [{ lastReadAt: ownReadAt.toISOString() }]);
  assert.deepEqual(data.devices, [{ enabled: false }]);
  const serialized = JSON.stringify(data);
  for (const excluded of [a.accessToken, a.refreshToken, ownSession.hash, ownSelfieKey, pushToken, b.phone, c.phone, 'Other author', 'Incoming private', 'Unrelated private', 'Unrelated conversation']) {
    assert.equal(serialized.includes(excluded), false, 'Export leaked a credential or another user\'s content');
  }
   await reauth(c);
   assert.equal((await call(`/account/export?userId=${a.userId}`, c.accessToken)).data.account.id, c.userId);
});

test('sensitive actions allow fresh login and require session-isolated, single-use reauthentication when stale', async () => {
  const user = await account();
  assert.equal((await call('/account/export', user.accessToken)).status, 200);
  const fresh = await call('/auth/reauth/request', user.accessToken, 'POST');
  assert.equal(fresh.data.method, 'recent'); assert.ok(fresh.data.expiresIn <= 600);
  const secondary = await db.session.create({ data: { userId: user.userId, hash: randomUUID(), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - 660000) } });
  const secondaryToken = await app.get(JwtService).signAsync({ sub: user.userId, sid: secondary.id });
  await db.session.updateMany({ where: { userId: user.userId }, data: { createdAt: new Date(Date.now() - 660000), reauthenticatedAt: null } });
  const denied = await call('/account/export', user.accessToken); assert.equal(denied.status, 403); assert.equal(denied.data.code, 'REAUTH_REQUIRED');
  assert.equal((await call('/account', user.accessToken, 'DELETE', { confirmation: 'DELETE' })).status, 403);
  const requested = await call('/auth/reauth/request', user.accessToken, 'POST');
  assert.equal(requested.status, 201); assert.equal(requested.data.method, 'phone');
  assert.equal(requested.data.hint.includes(user.phone), false);
  assert.equal((await call('/auth/reauth/verify', secondaryToken, 'POST', { code: requested.data.devCode })).status, 400);
  const results = await Promise.all([1, 2].map(() => call('/auth/reauth/verify', user.accessToken, 'POST', { code: requested.data.devCode })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400]);
  assert.equal((await call('/account/export', user.accessToken)).status, 200);
  assert.equal((await call('/account/export', secondaryToken)).status, 403);
  const session = await db.session.findFirstOrThrow({ where: { userId: user.userId, id: { not: secondary.id } } });
  await db.session.update({ where: { id: session.id }, data: { reauthenticatedAt: new Date(Date.now() - 660000) } });
  assert.equal((await call('/account/export', user.accessToken)).status, 403);
});

test('OTP endpoint throttles bursts', async () => {
  const results = [];
  for (let i = 0; i < 12; i++) results.push((await call('/auth/otp/request', null, 'POST', { phone: 'invalid' })).status);
  assert.ok(results.includes(429), `Expected throttling, received ${results.join(',')}`);
});
