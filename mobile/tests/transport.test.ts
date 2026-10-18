import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, HttpClient, type Tokens } from '../src/transport';
import { resolveApiAddress } from '../src/api-address';

const initial = { accessToken: 'expired', refreshToken: 'refresh-one' };
const storage = () => { let value: Tokens | null = initial; return { read: async () => value, write: async (next: Tokens | null) => { value = next; } }; };
test('parallel 401s share one token refresh and retry with the new access token', async () => {
  let refreshes = 0;
  const client = new HttpClient('https://api.example/v1', storage(), async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) { refreshes++; await new Promise((resolve) => setTimeout(resolve, 20)); return Response.json({ accessToken: 'new', refreshToken: 'refresh-two' }); }
    return (init?.headers as Record<string, string>).Authorization === 'Bearer new' ? Response.json({ ok: true }) : Response.json({ message: 'expired' }, { status: 401 });
  });
  await client.hydrate();
  const results = await Promise.all([client.request('/me'), client.request('/trips')]);
  assert.equal(refreshes, 1); assert.deepEqual(results, [{ ok: true }, { ok: true }]);
});
test('offline errors preserve the session and expired refresh clears it', async () => {
  const offline = new HttpClient('https://api.example/v1', storage(), async () => { throw new TypeError('Network failed'); });
  await offline.hydrate(); await assert.rejects(offline.request('/me'), (error: unknown) => error instanceof ApiError && error.status === 0); assert.deepEqual(offline.tokens, initial);
  const expired = new HttpClient('https://api.example/v1', storage(), async () => Response.json({}, { status: 401 }));
  let notified = false; expired.onExpired = () => { notified = true; }; await expired.hydrate();
  await assert.rejects(expired.request('/me')); assert.equal(expired.tokens, null); assert.equal(notified, true);
});
test('public HTTPS endpoints are preserved', () => {
  assert.equal(resolveApiAddress('https://api.example/v1/', undefined, false, false), 'https://api.example/v1');
});

test('logout cannot be undone by an in-flight refresh response', async () => {
  let release: ((response: Response) => void) | undefined;
  const client = new HttpClient('https://api.example/v1', storage(), async (url) => {
    if (String(url).endsWith('/auth/refresh')) return new Promise<Response>((resolve) => { release = resolve; });
    return Response.json({ message: 'expired' }, { status: 401 });
  });
  await client.hydrate();
  const request = client.request('/me');
  for (let attempt = 0; attempt < 20 && !release; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(release);
  await client.clear();
  release!(Response.json({ accessToken: 'new', refreshToken: 'new-refresh' }));
  await assert.rejects(request, /session changed|sign in again/i);
  assert.equal(client.tokens, null);
});

test('an old unauthorized mutation cannot be replayed with a different account token', async () => {
  let release: ((response: Response) => void) | undefined;
  let requests = 0;
  const client = new HttpClient('https://api.example/v1', storage(), async () => { requests++; return new Promise<Response>((resolve) => { release = resolve; }); });
  await client.hydrate();
  const pending = client.request('/account', 'DELETE', { confirmation: 'DELETE' });
  await client.setTokens({ accessToken: 'other-account', refreshToken: 'other-refresh' });
  release!(Response.json({ message: 'expired' }, { status: 401 }));
  await assert.rejects(pending, /session changed/i);
  assert.equal(requests, 1);
  assert.equal(client.tokens?.accessToken, 'other-account');
});

test('a failed refresh for the previous account cannot clear the new login', async () => {
  let release: ((response: Response) => void) | undefined;
  const client = new HttpClient('https://api.example/v1', storage(), async (url) => {
    if (String(url).endsWith('/auth/refresh')) return new Promise<Response>((resolve) => { release = resolve; });
    return Response.json({ message: 'expired' }, { status: 401 });
  });
  await client.hydrate(); const pending = client.request('/me');
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  await client.setTokens({ accessToken: 'other-account', refreshToken: 'other-refresh' });
  release!(Response.json({ message: 'expired' }, { status: 401 }));
  await assert.rejects(pending, /session changed/i);
  assert.equal(client.tokens?.accessToken, 'other-account');
});
