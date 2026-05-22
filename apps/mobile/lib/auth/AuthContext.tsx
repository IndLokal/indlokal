/**
 * Global auth state — PRD-0019 / TDD-0019.
 *
 * AuthProvider:
 *   - Restores the user from SecureStore on mount (with token refresh if
 *     needed) so the app never shows the sign-in screen for a user who
 *     already has a valid session.
 *   - Exposes `user`, `isLoading`, `onSignIn`, and `signOut` to every
 *     component in the tree via `useAuth()`.
 *
 * Routing after session restore / sign-in is handled by the caller
 * (sign-in screens and _layout.tsx) because they have access to the
 * Expo Router `router` instance. This context only manages state.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authClient } from './client.expo';
import type { AuthUser } from './token-store';

// ─── Types ────────────────────────────────────────────────────────────────

export type AuthContextValue = {
  /** Authenticated user, or null when anonymous / loading. */
  user: AuthUser | null;
  /** True while the initial session-restore is in progress. */
  isLoading: boolean;
  /**
   * Call this immediately after a successful sign-in so the context
   * reflects the new user without waiting for a re-render cycle that
   * reads from SecureStore.
   */
  onSignIn: (user: AuthUser) => void;
  /**
   * Signs the user out: revokes the refresh token server-side (best
   * effort), clears SecureStore, and resets the in-memory user to null.
   */
  signOut: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  onSignIn: () => {},
  signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guard against state updates after unmount (strict-mode double-effect).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── Session restore ──────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const tokens = await authClient.getTokens();

        if (!tokens) {
          if (mounted.current) setIsLoading(false);
          return;
        }

        // If access token is still fresh (>30 s until expiry) use it directly.
        const expiresAt = new Date(tokens.accessExpiresAt).getTime();
        if (Date.now() < expiresAt - 30_000) {
          if (mounted.current) {
            setUser(tokens.user);
            setIsLoading(false);
          }
          return;
        }

        // Access token expired or nearly so — attempt a silent refresh.
        const refreshed = await authClient.refreshAccessToken();
        if (mounted.current) {
          setUser(refreshed?.user ?? null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[auth/session-restore]', err);
        if (mounted.current) {
          setUser(null);
          setIsLoading(false);
        }
      }
    })();
  }, []); // intentionally empty — runs once on mount

  // ── onSignIn ────────────────────────────────────────────────────────
  const onSignIn = useCallback((newUser: AuthUser) => {
    setUser(newUser);
  }, []);

  // ── signOut ─────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const tokens = await authClient.getTokens();
      if (tokens?.refreshToken) {
        // Best effort — don't block UI if the request fails.
        await authClient
          .postPublic<
            { refreshToken: string },
            { ok: boolean }
          >('/api/v1/auth/logout', { refreshToken: tokens.refreshToken })
          .catch((err: unknown) => {
            console.error('[auth/sign-out] logout request failed (continuing)', err);
          });
      }
    } finally {
      await authClient.clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, onSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
