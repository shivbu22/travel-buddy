function isLocalHost(hostname: string) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(hostname)
    || /^192\.168\.(?:\d{1,3}\.)\d{1,3}$/.test(hostname)
    || /^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}$/.test(hostname);
}

function normalizeLocalAddress(value: string) {
  try {
    const url = new URL(value);
    // The development API is plain HTTP. Expo Go can retain an older HTTPS
    // value in its bundle, so never try TLS directly against a local IP.
    if (url.protocol === 'https:' && isLocalHost(url.hostname)) url.protocol = 'http:';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

export function resolveApiAddress(configured: string | undefined, hostUri: string | undefined, development: boolean, web: boolean) {
  const value = configured?.trim();
  let configuredHost = '';
  try { configuredHost = value ? new URL(value).hostname : ''; } catch { /* Fall through to the configured string below. */ }
  if (web && value && configuredHost && isLocalHost(configuredHost) && typeof location !== 'undefined' && isLocalHost(location.hostname)) {
    try {
      const url = new URL(value);
      // A same-machine web build should use the browser's loopback host. This
      // avoids Chrome Private Network Access blocking 127.0.0.1 → LAN calls.
      url.hostname = location.hostname;
      return normalizeLocalAddress(url.toString());
    } catch { /* Fall through to the configured address. */ }
  }
  if (development && !web && hostUri) {
    try {
      const host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
      // A local Metro host is the most reliable LAN address. Prefer it over a
      // stale .env IP so a DHCP change does not strand the app on startup.
      if ((!configuredHost || isLocalHost(configuredHost)) && (isLocalHost(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host))) return `http://${host}:4000/v1`;
    } catch { /* Use the simulator fallback when Expo has no usable host. */ }
  }
  if (value) return normalizeLocalAddress(value);
  return 'http://localhost:4000/v1';
}

export function normalizePhotoUrl(photo: string, apiUrl: string) {
  try {
    const url = new URL(photo);
    if (isLocalHost(url.hostname)) {
      const api = new URL(apiUrl);
      url.protocol = api.protocol; url.host = api.host;
      return url.toString();
    }
  } catch { /* Keep external or legacy photo URLs intact. */ }
  return photo;
}
