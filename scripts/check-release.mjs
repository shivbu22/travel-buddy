import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Only disposable Docker resources are used. Production provider credentials are inert fixtures.
const runtimeImage = process.env.RAAHI_RUNTIME_IMAGE || 'raahi-api:prelaunch';
const migrateImage = process.env.RAAHI_MIGRATE_IMAGE || 'raahi-migrate:prelaunch';
const dockerBin = process.platform === 'win32' ? 'docker.exe' : 'docker';
const prefix = `raahi-release-${randomUUID()}`;
const network = `${prefix}-network`;
const database = `${prefix}-db`;
const publicVolume = `${prefix}-public`;
const privateVolume = `${prefix}-private`;
const containers = [], volumes = [];
let networkCreated = false;

function docker(args, allowFailure = false) {
  const result = spawnSync(dockerBin, args, { encoding: 'utf8', timeout: 180000, windowsHide: true });
  if (result.status !== 0 && !allowFailure) throw new Error(`Docker ${args[0]} failed: ${result.error?.message || result.stderr}`);
  return result;
}
function inspect(name) { return JSON.parse(docker(['inspect', name]).stdout)[0]; }
async function waitFor(label, check) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await delay(1000);
  }
  throw new Error(`${label} did not become ready within 60 seconds.`);
}
const databaseUrl = `postgresql://raahi:raahi@${database}:5432/raahi_release_test`;
const commonEnv = {
  DATABASE_URL: databaseUrl,
  JWT_SECRET: randomBytes(40).toString('hex'),
  ADMIN_TOKEN: randomBytes(40).toString('hex'),
  CLIENT_ORIGIN: 'https://app.release-test.invalid',
  PUBLIC_URL: 'https://api.release-test.invalid',
  SUPPORT_EMAIL: 'support@release-test.invalid',
  APPLE_CLIENT_ID: 'com.raahi.travel',
  APPLE_TEAM_ID: 'release-test-team', APPLE_KEY_ID: 'release-test-key', APPLE_PRIVATE_KEY: 'release-test-private-key', APPLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
};
function startApi(name, env) {
  containers.push(name);
  docker(['run', '-d', '--name', name, '--network', network, '-p', '127.0.0.1::4000',
    '--read-only', '--tmpfs', '/tmp:size=128m', '--memory', '768m', '--cpus', '1.5', '--pids-limit', '100',
    '--security-opt', 'no-new-privileges:true', '--cap-drop', 'ALL',
    '--health-interval', '2s', '--health-start-period', '5s',
    '--mount', `type=volume,source=${publicVolume},target=/data/uploads`,
    '--mount', `type=volume,source=${privateVolume},target=/data/verification`,
    ...Object.entries({ ...commonEnv, ...env }).flatMap(([key, value]) => ['-e', `${key}=${value}`]), runtimeImage]);
  return `http://127.0.0.1:${inspect(name).NetworkSettings.Ports['4000/tcp'][0].HostPort}`;
}
async function ready(name) {
  await waitFor(name, () => {
    const state = inspect(name).State;
    if (!state.Running) throw new Error(`${name} exited before becoming healthy.`);
    return state.Health?.Status === 'healthy';
  });
}

try {
  docker(['image', 'inspect', runtimeImage]);
  docker(['image', 'inspect', migrateImage]);
  docker(['network', 'create', network]); networkCreated = true;
  for (const volume of [publicVolume, privateVolume]) {
    docker(['volume', 'create', volume]); volumes.push(volume);
  }
  containers.push(database);
  docker(['run', '-d', '--name', database, '--network', network,
    '-e', 'POSTGRES_USER=raahi', '-e', 'POSTGRES_PASSWORD=raahi', '-e', 'POSTGRES_DB=raahi_release_test', 'postgres:16-alpine']);
  await waitFor('PostgreSQL', () => docker(['exec', database, 'pg_isready', '-U', 'raahi', '-d', 'raahi_release_test'], true).status === 0);
  await waitFor('PostgreSQL network', () => docker(['run', '--rm', '--network', network, 'postgres:16-alpine', 'pg_isready', '-h', database, '-U', 'raahi', '-d', 'raahi_release_test'], true).status === 0);
  const migration = `${prefix}-migrate`; containers.push(migration);
  docker(['run', '--name', migration, '--network', network, '-e', `DATABASE_URL=${databaseUrl}`, migrateImage]);
  console.log('Fresh-database migrations passed.');

  const production = `${prefix}-production`;
  const base = startApi(production, {
    NODE_ENV: 'production', AUTH_MODE: 'twilio',
    TWILIO_ACCOUNT_SID: `AC${'0'.repeat(32)}`, TWILIO_AUTH_TOKEN: 'inert-release-test-token', TWILIO_VERIFY_SERVICE_SID: `VA${'0'.repeat(32)}`,
  });
  await ready(production);
  const health = await fetch(`${base}/v1/health`, { signal: AbortSignal.timeout(10000) });
  assert.equal(health.status, 200);
  const healthData = await health.json();
  assert.equal(healthData.database, 'ok');
  assert.equal(healthData.production, true);
  assert.equal(health.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${base}/v1/account/export`)).status, 401);
  assert.equal((await fetch(`${base}/v1/admin/verifications`)).status, 403);
  for (const origin of [commonEnv.CLIENT_ORIGIN, 'https://untrusted.invalid']) {
    const response = await fetch(`${base}/v1/health`, { headers: { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin === commonEnv.CLIENT_ORIGIN ? origin : null);
  }
  const config = inspect(production);
  assert.equal(config.Config.User, 'node');
  assert.equal(config.HostConfig.ReadonlyRootfs, true);
  assert.ok(config.HostConfig.CapDrop.includes('ALL'));
  assert.ok(config.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  docker(['exec', production, 'node', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { writeFile, unlink } from 'node:fs/promises';
    assert.notEqual(process.getuid(), 0);
    await assert.rejects(writeFile('/app/server/read-only-check', 'probe'), { code: 'EROFS' });
    await writeFile('/data/uploads/release-write-check.txt', 'public');
    await unlink('/data/uploads/release-write-check.txt');
    await writeFile('/data/verification/release-private-check.txt', 'private');
  `]);
  assert.equal((await fetch(`${base}/uploads/release-private-check.txt`)).status, 404);
  console.log('Production startup, healthcheck, headers, auth, CORS, non-root/read-only runtime and media isolation passed.');
  docker(['stop', production]);

  const development = `${prefix}-development`;
  const devBase = startApi(development, { NODE_ENV: 'test', AUTH_MODE: 'development', PUBLIC_URL: 'http://127.0.0.1:4000' });
  await ready(development);
  const smoke = spawnSync(process.execPath, [fileURLToPath(new URL('./smoke-api.mjs', import.meta.url))], {
    env: { ...process.env, SMOKE_PHONE: `+919${Date.now().toString().slice(-9)}`, RAAHI_API_URL: `${devBase}/v1` },
    stdio: 'inherit', timeout: 60000, windowsHide: true,
  });
  assert.equal(smoke.status, 0, 'Development-auth smoke test failed in the restricted runtime.');
  console.log('Release container check passed. Live Twilio, TLS termination and native-device testing remain separate.');
} finally {
  let cleanupFailed = false;
  for (const name of containers.reverse()) {
    if (docker(['rm', '-fv', name], true).status !== 0) { console.error(`Cleanup failed for container ${name}`); cleanupFailed = true; }
  }
  for (const volume of volumes.reverse()) {
    if (docker(['volume', 'rm', volume], true).status !== 0) { console.error(`Cleanup failed for volume ${volume}`); cleanupFailed = true; }
  }
  if (networkCreated && docker(['network', 'rm', network], true).status !== 0) { console.error(`Cleanup failed for network ${network}`); cleanupFailed = true; }
  if (cleanupFailed) process.exitCode = 1;
}
