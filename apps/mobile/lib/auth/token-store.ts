import type { auth } from '@indlokal/shared';

const STORAGE_KEY = 'indlokal.auth.tokens.v1';

export type AuthUser = auth.MeProfile;

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  user: AuthUser;
};

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export function createMemorySecureStore(initial: Record<string, string> = {}): SecureStoreLike {
  const data = new Map<string, string>(Object.entries(initial));

  return {
    async getItemAsync(key: string) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      data.set(key, value);
    },
    async deleteItemAsync(key: string) {
      data.delete(key);
    },
  };
}

export function createTokenStore(store: SecureStoreLike) {
  return {
    async read(): Promise<AuthTokens | null> {
      const raw = await store.getItemAsync(STORAGE_KEY);
      if (!raw) return null;

      try {
        return JSON.parse(raw) as AuthTokens;
      } catch {
        await store.deleteItemAsync(STORAGE_KEY);
        return null;
      }
    },

    async write(tokens: AuthTokens): Promise<void> {
      await store.setItemAsync(STORAGE_KEY, JSON.stringify(tokens));
    },

    async clear(): Promise<void> {
      await store.deleteItemAsync(STORAGE_KEY);
    },
  };
}
