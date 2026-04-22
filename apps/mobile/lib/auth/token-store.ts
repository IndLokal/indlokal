const STORAGE_KEY = 'indlokal.auth.tokens.v1';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'COMMUNITY_ADMIN' | 'PLATFORM_ADMIN';
  cityId: string | null;
  personaSegments: string[];
  preferredLanguages: string[];
  onboardingComplete: boolean;
  createdAt: string;
  lastActiveAt: string | null;
};

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
