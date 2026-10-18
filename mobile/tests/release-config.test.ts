import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { releaseConfig } = createRequire(import.meta.url)('../release-config.cjs');
const base = { name: 'Raahi', ios: { bundleIdentifier: 'com.raahi.travel', infoPlist: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } }, extra: { eas: { projectId: 'existing-project' } } };
const production = {
  EAS_BUILD_PROFILE: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.raahi.app/v1',
  EXPO_PUBLIC_PRIVACY_URL: 'https://raahi.app/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://raahi.app/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://raahi.app/support',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@raahi.app',
};

test('preview permits the local API and preserves development networking', () => {
  const result = releaseConfig(base, { EAS_BUILD_PROFILE: 'simulator', EXPO_PUBLIC_API_URL: 'http://192.168.1.7:4000/v1' });
  assert.equal(result.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking, true);
  assert.equal(result.extra.eas.projectId, 'existing-project');
});
test('production rejects missing, cleartext, local and placeholder endpoints before building', () => {
  for (const EXPO_PUBLIC_API_URL of [undefined, 'http://api.raahi.app/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1', 'https://192.168.1.7/v1', 'https://api.local/v1', 'https://api.example.com/v1', 'https://api.raahi.app']) {
    assert.throws(() => releaseConfig(base, { ...production, EXPO_PUBLIC_API_URL }), /EXPO_PUBLIC_API_URL/);
  }
  for (const key of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_SUPPORT_URL', 'EXPO_PUBLIC_SUPPORT_EMAIL']) {
    assert.throws(() => releaseConfig(base, { ...production, [key]: undefined }), new RegExp(key));
  }
});
test('production strips local ATS exceptions and retains project identity and public legal links', () => {
  const result = releaseConfig(base, production);
  assert.deepEqual(result.ios.infoPlist.NSAppTransportSecurity, { NSAllowsArbitraryLoads: false, NSAllowsArbitraryLoadsInWebContent: false, NSAllowsLocalNetworking: false });
  assert.equal(result.ios.bundleIdentifier, 'com.raahi.travel');
  assert.equal(result.extra.eas.projectId, 'existing-project');
  assert.equal(result.extra.publicLinks.privacy, production.EXPO_PUBLIC_PRIVACY_URL);
  assert.equal(result.ios.usesAppleSignIn, true);
});
