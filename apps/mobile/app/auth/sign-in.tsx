import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { signInWithGoogleCode, useGoogleCodeFlow } from '@/lib/auth/google';
import { authFlags } from '@/lib/config/flags';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      .then(() => {
        router.replace('/(tabs)');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Google sign-in failed';
        Alert.alert('Google sign-in failed', message);
      })
      .finally(() => {
        setGoogleLoading(false);
      });
  }, [googleFlow.redirectUri, googleFlow.request?.codeVerifier, googleFlow.response]);

  const canSubmitMagicLink = useMemo(() => email.includes('@'), [email]);

  async function onMagicLinkPress() {
    if (!canSubmitMagicLink) return;

    setLoading(true);
    try {
      await requestMagicLink(authClient, email.trim().toLowerCase());
      router.push({ pathname: '/auth/magic-link-sent', params: { email } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to send magic link';
      Alert.alert('Unable to send magic link', message);
    } finally {
      setLoading(false);
    }
  }

  async function onGooglePress() {
    if (!googleFlow.enabled) {
      Alert.alert('Google sign-in unavailable', 'Google OAuth client IDs are not configured.');
      return;
    }
    await googleFlow.promptAsync();
  }

  async function onApplePress() {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Apple sign-in unavailable', 'Apple sign-in is not available on this device.');
        return;
      }

      setLoading(true);
      await signInWithApple(authClient);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Apple sign-in failed';
      Alert.alert('Apple sign-in failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to IndLokal</Text>
        <Text style={styles.subtitle}>Sign in to save communities, events, and get reminders.</Text>

        {authFlags.magic.enabled ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Magic link</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
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

        {authFlags.google.enabled ? (
          <Pressable
            onPress={onGooglePress}
            style={styles.secondaryButton}
            disabled={googleLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
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
    backgroundColor: '#f6f8fc',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderColor: '#dbe3f1',
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d7e2',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
