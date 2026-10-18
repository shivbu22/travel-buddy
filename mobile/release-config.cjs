const { isIP } = require('node:net');

function publicHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host.includes('.') && !isIP(host) && !/(^|\.)(localhost|local|lan|internal|invalid|test)$/.test(host)
    && !/(^|\.)(example\.(com|org|net))$/.test(host);
}

function publicUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be configured as a public HTTPS URL for an App Store build.`); }
  if (url.protocol !== 'https:' || !publicHostname(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must use HTTPS and a public domain, without credentials, a query or a fragment.`);
  }
  return url.toString();
}

function releaseConfig(config, env = process.env) {
  const production = env.RAAHI_RELEASE_CHANNEL === 'production' || env.EAS_BUILD_PROFILE === 'production';
  if (!production) return { ...config, extra: { ...config.extra, releaseChannel: 'preview' } };

  const api = publicUrl(env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
  if (!new URL(api).pathname.replace(/\/$/, '').endsWith('/v1')) throw new Error('EXPO_PUBLIC_API_URL must include the API /v1 prefix.');
  const links = {
    privacy: publicUrl(env.EXPO_PUBLIC_PRIVACY_URL, 'EXPO_PUBLIC_PRIVACY_URL'),
    terms: publicUrl(env.EXPO_PUBLIC_TERMS_URL, 'EXPO_PUBLIC_TERMS_URL'),
    support: publicUrl(env.EXPO_PUBLIC_SUPPORT_URL, 'EXPO_PUBLIC_SUPPORT_URL'),
  };
  const email = env.EXPO_PUBLIC_SUPPORT_EMAIL || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !publicHostname(email.split('@')[1])) {
    throw new Error('EXPO_PUBLIC_SUPPORT_EMAIL must be configured with a public support email address.');
  }
  return {
    ...config,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      infoPlist: {
        ...config.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsArbitraryLoadsInWebContent: false,
          NSAllowsLocalNetworking: false,
        },
      },
    },
    extra: { ...config.extra, releaseChannel: 'production', publicLinks: links },
  };
}

module.exports = { releaseConfig };
