import sharp from 'sharp';

const baseUrl = (process.env.RAAHI_API_URL || 'http://127.0.0.1:4000/v1').replace(/\/$/, '');
const phone = process.env.SMOKE_PHONE || `+9191${Date.now().toString().slice(-10)}`;
const fail = (message) => { throw new Error(message); };
const json = async (response) => response.json().catch(() => null);
const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await json(response);
  if (!response.ok) fail(`${init.method || 'GET'} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
};

const health = await request('/health');
if (health.status !== 'ok' || health.database !== 'ok') fail(`Health check is not ready: ${JSON.stringify(health)}`);
const otp = await request('/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
if (!otp.devCode) fail('Smoke test requires AUTH_MODE=development so it can verify the returned OTP without an SMS provider.');
const session = await request('/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: otp.devCode }) });
const headers = { Authorization: `Bearer ${session.accessToken}` };
const reauth = await request('/auth/reauth/request', { method: 'POST', headers });
if (!reauth.alreadyVerified) {
  if (!reauth.devCode) fail('Smoke test requires a development re-authentication code.');
  await request('/auth/reauth/verify', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ code: reauth.devCode }) });
}
const form = new FormData();
const smokeImage = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#E1037D' } }).jpeg().toBuffer();
form.append('file', new Blob([smokeImage], { type: 'image/jpeg' }), 'smoke.jpg');
const photo = await request('/me/photos', { method: 'POST', headers, body: form });
if (!Array.isArray(photo.photos) || photo.photos.length !== 1) fail('Photo upload smoke assertion failed.');
const exported = await request('/account/export', { headers });
if (!exported.account?.id || !Array.isArray(exported.trips) || !Array.isArray(exported.posts)) fail('Data export smoke assertion failed.');
await request('/account', { method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }) });
console.log(JSON.stringify({ ok: true, baseUrl, phone, photoCount: photo.photos.length }));
