import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LogoMark } from '@/components/Logo';
import { authClient } from '@/lib/auth/client.expo';
import { requestMagicLink } from '@/lib/auth/magic';
import { palette, spacing, typography } from '@/constants/theme';

export default function MagicLinkSentScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function onResend() {
    if (!params.email || resending) return;
    setResending(true);
    try {
      await requestMagicLink(authClient, params.email);
      setResent(true);
    } catch {
      // Best effort — back-to-sign-in link remains available.
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LogoMark size={48} />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a sign-in link to {params.email ?? 'your inbox'}. Open the link on this device to
          continue.
        </Text>

        {params.email && (
          <Pressable
            style={[styles.resendButton, resending && styles.resendDisabled]}
            disabled={resending || resent}
            onPress={() => void onResend()}
          >
            {resending ? (
              <ActivityIndicator color={palette.brand[600]} />
            ) : (
              <Text style={styles.resendText}>{resent ? 'Link sent again' : 'Re-send link'}</Text>
            )}
          </Pressable>
        )}

        <Link href="/auth/sign-in" style={styles.link}>
          Back to sign in
        </Link>
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: palette.neutral.foreground,
    textAlign: 'center',
  },
  body: {
    fontSize: typography.body,
    lineHeight: 24,
    color: palette.neutral.muted,
    textAlign: 'center',
  },
  resendButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.brand[600],
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    color: palette.brand[600],
    fontWeight: '600',
    fontSize: typography.body,
  },
  link: {
    marginTop: spacing.sm,
    color: palette.brand[600],
    fontWeight: '700',
  },
});
