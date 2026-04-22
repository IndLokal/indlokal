import { auth } from '@indlokal/shared';
import { createMemorySecureStore, createTokenStore, type AuthTokens } from './token-store';

type RequestOptions = {
  auth?: boolean;
  retryOnAuthError?: boolean;
};

type CreateAuthClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  store?: ReturnType<typeof createTokenStore>;
};

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://indlokal.com';

export class AuthClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AuthClientError';
    this.status = status;
    this.code = code;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function createAuthClient(options: CreateAuthClientOptions = {}) {
  const apiBaseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.store ?? createTokenStore(createMemorySecureStore());

  let refreshInFlight: Promise<AuthTokens | null> | null = null;

  async function requestJson<T>(
    path: string,
    init: RequestInit,
    opts: RequestOptions = {},
  ): Promise<T> {
    const useAuth = opts.auth ?? false;
    const retryOnAuthError = opts.retryOnAuthError ?? true;

    const headers = new Headers(init.headers ?? {});
    headers.set('Content-Type', 'application/json');

    if (useAuth) {
      const existingTokens = await store.read();
      if (existingTokens?.accessToken) {
        headers.set('Authorization', `Bearer ${existingTokens.accessToken}`);
      }
    }

    const response = await fetchImpl(joinUrl(apiBaseUrl, path), { ...init, headers });

    if (response.status === 401 && useAuth && retryOnAuthError) {
      const refreshed = await refreshAccessToken();
      if (refreshed?.accessToken) {
        return requestJson<T>(path, init, {
          auth: true,
          retryOnAuthError: false,
        });
      }
    }

    if (!response.ok) {
      let parsedError: unknown;
      try {
        parsedError = await response.json();
      } catch {
        parsedError = null;
      }

      const errorEnvelope =
        parsedError && typeof parsedError === 'object' && 'error' in parsedError
          ? (parsedError as { error?: { code?: string; message?: string } }).error
          : undefined;

      throw new AuthClientError(
        errorEnvelope?.message ?? `request failed with status ${response.status}`,
        response.status,
        errorEnvelope?.code,
      );
    }

    return (await response.json()) as T;
  }

  async function refreshAccessToken(): Promise<AuthTokens | null> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const existingTokens = await store.read();
      if (!existingTokens?.refreshToken) return null;

      try {
        const refreshed = await requestJson<AuthTokens>(
          '/api/v1/auth/refresh',
          {
            method: 'POST',
            body: JSON.stringify({ refreshToken: existingTokens.refreshToken }),
          },
          { auth: false, retryOnAuthError: false },
        );

        const parsed = auth.AuthTokens.parse(refreshed);
        await store.write(parsed);
        return parsed;
      } catch {
        await store.clear();
        return null;
      }
    })();

    const result = await refreshInFlight;
    refreshInFlight = null;
    return result;
  }

  return {
    apiBaseUrl,
    async getTokens() {
      return store.read();
    },
    async setTokens(tokens: AuthTokens) {
      await store.write(tokens);
    },
    async clearTokens() {
      await store.clear();
    },
    async postPublic<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq) {
      return requestJson<TRes>(
        path,
        { method: 'POST', body: JSON.stringify(body) },
        { auth: false },
      );
    },
    async postAuthed<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq) {
      return requestJson<TRes>(
        path,
        { method: 'POST', body: JSON.stringify(body) },
        { auth: true },
      );
    },
    async putAuthed<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq) {
      return requestJson<TRes>(path, { method: 'PUT', body: JSON.stringify(body) }, { auth: true });
    },
    async patchAuthed<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq) {
      return requestJson<TRes>(
        path,
        { method: 'PATCH', body: JSON.stringify(body) },
        { auth: true },
      );
    },
    async deleteAuthed<TRes>(path: string) {
      return requestJson<TRes>(path, { method: 'DELETE' }, { auth: true });
    },
    async getAuthed<TRes>(path: string) {
      return requestJson<TRes>(path, { method: 'GET' }, { auth: true });
    },
    async getPublic<TRes>(path: string) {
      return requestJson<TRes>(path, { method: 'GET' }, { auth: false });
    },
    refreshAccessToken,
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
