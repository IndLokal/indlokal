import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { authClient } from '@/lib/auth/client.expo';
import { signInWithApple } from '@/lib/auth/apple';
import { requestMagicLink } from '@/lib/auth/magic';
import {
  logGoogleSignInDiagnostics,
  signInWithGoogleCode,
  useGoogleCodeFlow,
} from '@/lib/auth/google';
import { describeAuthError } from '@/lib/auth/auth-errors';
import { authFlags } from '@/lib/config/flags';
import { useAuth } from '@/lib/auth/AuthContext';
import { LogoMark } from '@/components/Logo';
import { palette, radius, spacing, typography } from '@/constants/theme';
import type { AuthTokens } from '@/lib/auth/token-store';

function routeAfterAuth(tokens: AuthTokens) {
  router.replace(tokens.user.onboardingComplete ? '/(tabs)' : '/auth/onboarding/city');
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'error' | 'warning' | 'success';
    text: string;
  } | null>(null);

  const { onSignIn } = useAuth();
  const googleFlow = useGoogleCodeFlow();

  useEffect(() => {
    if (googleFlow.response?.type !== 'success') return;

    const code = googleFlow.response.params.code;
    if (!code) return;

    setGoogleLoading(true);
    signInWithGoogleCode(authClient, {
      code,
      redirectUri: googleFlow.redirectUri,
      codeVerifier: googleFlow.request?.codeVerifier,
    })
      .then((tokens) => {
        setStatusMessage(null);
        onSignIn(tokens.user);
        routeAfterAuth(tokens);
      })
      .catch((error: unknown) => {
        setStatusMessage({
          tone: 'error',
          text: describeAuthError(error, 'google'),
        });
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  }, [googleFlow.redirectUri, googleFlow.request?.codeVerifier, googleFlow.response, onSignIn]);

  const canSubmitMagicLink = useMemo(() => email.includes('@'), [email]);

  async function onMagicLinkPress() {
    if (!canSubmitMagicLink) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      await requestMagicLink(authClient, email.trim().toLowerCase());
      router.push({ pathname: '/auth/magic-link-sent', params: { email } });
    } catch (error: unknown) {
      setStatusMessage({
        tone: 'warning',
        text: describeAuthError(error, 'magic'),
      });
    } finally {
      setLoading(false);
    }
  }

  async function onGooglePress() {
    logGoogleSignInDiagnostics({
      redirectUri: googleFlow.redirectUri,
      apiBaseUrl: authClient.apiBaseUrl,
      enabled: googleFlow.enabled,
    });
    if (!googleFlow.enabled) {
      setStatusMessage({
        tone: 'warning',
        text: 'Google sign-in is not available right now. Please use email sign-in.',
      });
      return;
    }
    setStatusMessage(null);
    await googleFlow.promptAsync();
  }

  async function onApplePress() {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        setStatusMessage({
          tone: 'warning',
          text: 'Apple sign-in is not available on this device.',
        });
        return;
      }

      setLoading(true);
      setStatusMessage(null);
      const tokens = await signInWithApple(authClient);
      onSignIn(tokens.user);
      routeAfterAuth(tokens);
    } catch (error: unknown) {
      // expo-apple-authentication throws ERR_REQUEST_CANCELED on user cancel —
      // stay silent in that case instead of showing a scary alert.
      const canceled =
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'ERR_REQUEST_CANCELED';
      if (!canceled) {
        setStatusMessage({
          tone: 'error',
          text: describeAuthError(error, 'apple'),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <LogoMark size={56} />
          <Text style={styles.brandName}>IndLokal</Text>
          <Text style={styles.tagline}>Your Indian community, locally.</Text>
        </View>

        <Text style={styles.subtitle}>
          Sign in to save communities, follow events, and get reminders for what&apos;s happening in
          your city.
        </Text>

        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              statusMessage.tone === 'error' && styles.statusBannerError,
              statusMessage.tone === 'warning' && styles.statusBannerWarning,
              statusMessage.tone === 'success' && styles.statusBannerSuccess,
            ]}
          >
            <Text
              style={[
                styles.statusBannerText,
                statusMessage.tone === 'error' && styles.statusBannerTextError,
                statusMessage.tone === 'warning' && styles.statusBannerTextWarning,
                statusMessage.tone === 'success' && styles.statusBannerTextSuccess,
              ]}
            >
              {statusMessage.text}
            </Text>
          </View>
        ) : null}

        {authFlags.magic.enabled ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email magic link</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={palette.neutral.muted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
            <Pressable
              onPress={onMagicLinkPress}
              disabled={loading || !canSubmitMagicLink}
              style={[
                styles.primaryButton,
                (!canSubmitMagicLink || loading) && styles.disabledButton,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Send magic link</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {authFlags.google.enabled && googleFlow.enabled ? (
          <Pressable
            onPress={onGooglePress}
            style={styles.secondaryButton}
            disabled={googleLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {googleLoading ? 'Signing in with Google…' : 'Continue with Google'}
            </Text>
          </Pressable>
        ) : null}

        {authFlags.apple.enabled ? (
          <Pressable onPress={onApplePress} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Continue with Apple</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.neutral.background,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  brandName: {
    fontSize: typography.h1,
    fontWeight: '800',
    color: palette.brand[900],
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.body,
    color: palette.accent[600],
    fontWeight: '600',
  },
  subtitle: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  statusBanner: {
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  statusBannerError: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  statusBannerWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  statusBannerSuccess: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  statusBannerText: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  statusBannerTextError: {
    color: '#991b1b',
  },
  statusBannerTextWarning: {
    color: '#92400e',
  },
  statusBannerTextSuccess: {
    color: '#065f46',
  },
  section: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: palette.neutral.surface,
    borderColor: palette.neutral.border,
    borderWidth: 1,
    gap: spacing.md,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: typography.body,
    color: palette.neutral.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
    fontSize: typography.body,
  },
  primaryButton: {
    backgroundColor: palette.brand[600],
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  secondaryButton: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '700',
    color: palette.neutral.foreground,
    fontSize: typography.body,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
