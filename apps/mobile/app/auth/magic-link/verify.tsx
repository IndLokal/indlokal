/**
 * Magic-link verify handler — PRD-0008.
 * Reached via Universal Link (https://indlokal.com/auth/magic?token=...) or
 * the in-app scheme (indlokal://auth/magic?token=...).
 *
 * Exchanges the token for an access/refresh pair and routes the user to (tabs).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { authClient } from '@/lib/auth/client.expo';
import { verifyMagicLinkToken } from '@/lib/auth/magic';
import { palette, spacing, typography } from '@/constants/theme';

export default function MagicLinkVerifyScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof params.token === 'string' ? params.token : null;
    if (!token) {
      setError('Missing token. Request a new magic link.');
      return;
    }
    let cancelled = false;
    verifyMagicLinkToken(authClient, token)
      .then(() => {
        if (cancelled) return;
        router.replace('/(tabs)');
      })
      .catch(() => {
        if (cancelled) return;
        setError('That link expired or was already used. Request a new one.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Signing you in' }} />
      <View style={styles.container}>
        {!error ? (
          <>
            <ActivityIndicator color={palette.brand[600]} />
            <Text style={styles.title}>Finishing sign-in...</Text>
          </>
        ) : (
          <Text style={styles.error}>{error}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: typography.body, color: palette.neutral.muted },
  error: {
    fontSize: typography.body,
    color: palette.status.destructive,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
