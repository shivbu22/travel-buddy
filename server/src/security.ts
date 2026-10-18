export function clientOrigins() {
  const configured = process.env.CLIENT_ORIGIN?.trim();
  if (configured) return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
  const origins = ['http://localhost:8081', 'http://localhost:8082', 'http://localhost:4173', 'http://localhost:4174', 'http://localhost:4175', 'http://localhost:4176', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:4173', 'http://127.0.0.1:4174', 'http://127.0.0.1:4175', 'http://127.0.0.1:4176'];
  try {
    const publicUrl = new URL(process.env.PUBLIC_URL || '');
    if (publicUrl.hostname && !['localhost', '127.0.0.1'].includes(publicUrl.hostname)) for (const port of [4173, 4174, 4175, 4176, 8081, 8082]) origins.push(`http://${publicUrl.hostname}:${port}`);
  } catch { /* Development can use the loopback defaults when PUBLIC_URL is absent. */ }
  return origins;
}

export function validateEnvironment() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'PUBLIC_URL', 'CLIENT_ORIGIN', 'ADMIN_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_TOKEN_ENCRYPTION_KEY', 'SUPPORT_EMAIL'];
  if (required.some((key) => !process.env[key]) || process.env.AUTH_MODE !== 'twilio') throw new Error('Production credentials are incomplete.');
  if ((process.env.ADMIN_TOKEN?.length || 0) < 32) throw new Error('Production ADMIN_TOKEN must be at least 32 characters.');
  if (!process.env.PUBLIC_URL?.startsWith('https://') || clientOrigins().some((origin) => !origin.startsWith('https://') || origin.includes('*'))) throw new Error('Production URLs must be explicit HTTPS origins.');
  for (const origin of clientOrigins()) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) throw new Error('CLIENT_ORIGIN entries must be origins without paths.');
  }
}
