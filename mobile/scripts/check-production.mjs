import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { releaseConfig } = require('../release-config.cjs');
const { expo } = require('../app.json');
const config = releaseConfig(expo, { ...process.env, EAS_BUILD_PROFILE: 'production' });
const api = process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
const health = await fetch(`${api}/health`, { signal: AbortSignal.timeout(15000) });
assert.equal(health.status, 200, 'Production API health request failed.');
const body = await health.json();
assert.equal(body.status, 'ok', 'API is not healthy.');
assert.equal(body.database, 'ok', 'Production database is not ready.');
assert.equal(body.production, true, 'API did not confirm production mode.');
assert.ok(health.headers.get('strict-transport-security'), 'Production API must return HSTS.');
assert.equal(health.headers.get('cache-control'), 'no-store');
const unauthorized = await fetch(`${api}/account/export`, { signal: AbortSignal.timeout(15000) });
assert.equal(unauthorized.status, 401, 'Account export must reject unauthenticated requests.');
for (const [name, url] of Object.entries(config.extra.publicLinks)) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(response.status, 200, `${name} URL must be publicly accessible without redirect or login.`);
  assert.ok((await response.text()).trim().length >= 100, `${name} page is empty.`);
}
console.log('Production API, database, auth boundary and public policy/support URLs passed.');
