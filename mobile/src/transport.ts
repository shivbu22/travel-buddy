export type Tokens = { accessToken: string; refreshToken: string };
export interface TokenStorage { read(): Promise<Tokens | null>; write(tokens: Tokens | null): Promise<void> }
export class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } }

export class HttpClient {
  tokens: Tokens | null = null;
  onExpired: () => void = () => {};
  private refreshing: Promise<void> | null = null;
  private sessionEpoch = 0;
  private accountEpoch = 0;
  constructor(readonly baseUrl: string, private storage: TokenStorage, private fetcher: typeof fetch = fetch) {}
  async hydrate() { const epoch = this.sessionEpoch; const tokens = await this.storage.read(); if (epoch === this.sessionEpoch) this.tokens = tokens; return Boolean(this.tokens); }
  async setTokens(tokens: Tokens | null) { this.accountEpoch += 1; this.sessionEpoch += 1; this.refreshing = null; this.tokens = tokens; await this.storage.write(tokens); }
  async clear() { this.accountEpoch += 1; this.sessionEpoch += 1; this.refreshing = null; this.tokens = null; await this.storage.write(null); }
  private async fetch(path: string, method: string, body: unknown, authenticated: boolean) {
    const controller = new AbortController();
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const timer = setTimeout(() => controller.abort(), multipart ? 120000 : 15000);
    try {
      const request = { method, signal: controller.signal, headers: { ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(authenticated && this.tokens ? { Authorization: `Bearer ${this.tokens.accessToken}` } : {}) }, ...(body !== undefined ? { body: multipart ? body as FormData : JSON.stringify(body) } : {}) };
      // React Native and browser fetch implementations can depend on their
      // receiver. Preserve the global receiver while still allowing tests to
      // inject a custom fetcher.
      return await this.fetcher.call(globalThis, `${this.baseUrl}${path}`, request);
    } catch {
      const message = controller.signal.aborted
        ? multipart ? 'Upload is taking longer than expected. Your selected photos are kept below; retry when the connection improves.' : 'The server took too long to respond. Retry in a moment.'
        : `Cannot reach server at ${this.baseUrl}. Keep your phone and computer on the same Wi-Fi, allow TCP port 4000 through Windows Firewall, and retry.`;
      throw new ApiError(message, 0);
    }
    finally { clearTimeout(timer); }
  }
  private async refresh() {
    if (!this.refreshing) {
      const epoch = this.sessionEpoch;
      const refreshToken = this.tokens?.refreshToken;
      const pending = (async () => {
      if (!this.tokens) throw new ApiError('Sign in again to continue.', 401);
      const response = await this.fetch('/auth/refresh', 'POST', { refreshToken }, false);
      if (epoch !== this.sessionEpoch || this.tokens?.refreshToken !== refreshToken) throw new ApiError('Your session changed. Sign in again.', 401);
      if (!response.ok) { await this.clear(); this.onExpired(); throw new ApiError('Your session expired. Sign in again.', 401); }
      const tokens = await response.json() as Tokens;
      if (epoch !== this.sessionEpoch || this.tokens?.refreshToken !== refreshToken) throw new ApiError('Your session changed. Sign in again.', 401);
      this.sessionEpoch += 1; this.tokens = tokens; await this.storage.write(tokens);
      })();
      const settled = pending.finally(() => { if (this.refreshing === settled) this.refreshing = null; });
      this.refreshing = settled;
    }
    return this.refreshing;
  }
  async request<T>(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<T> {
    const epoch = this.accountEpoch;
    const usedToken = this.tokens?.accessToken;
    let response = await this.fetch(path, method, body, authenticated);
    if (authenticated && epoch !== this.accountEpoch) throw new ApiError('Your session changed. Retry from your current account.', 401);
    if (authenticated && response.status === 401 && this.tokens) {
      if (usedToken === this.tokens.accessToken) await this.refresh();
      if (epoch !== this.accountEpoch) throw new ApiError('Your session changed. Retry from your current account.', 401);
      response = await this.fetch(path, method, body, authenticated);
    }
    if (authenticated && epoch !== this.accountEpoch) throw new ApiError('Your session changed. Retry from your current account.', 401);
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => null);
    if (authenticated && epoch !== this.accountEpoch) throw new ApiError('Your session changed. Retry from your current account.', 401);
    if (!response.ok) throw new ApiError(Array.isArray(payload?.message) ? payload.message.join('\n') : payload?.message || 'That action could not be completed. Try again.', response.status, payload?.code);
    return payload as T;
  }
}
