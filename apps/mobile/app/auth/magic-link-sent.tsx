import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LogoMark } from '@/components/Logo';
import { palette, spacing, typography } from '@/constants/theme';

export default function MagicLinkSentScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LogoMark size={48} />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a sign-in link to {params.email ?? 'your inbox'}. Open the link on this device to
          continue.
        </Text>
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
  link: {
    marginTop: spacing.sm,
    color: palette.brand[600],
    fontWeight: '700',
  },
});
