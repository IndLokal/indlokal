import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: palette.neutral.background,
  },
  title: {
    fontSize: typography.h4,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  link: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    fontSize: typography.small,
    color: palette.brand[600],
    fontWeight: '700',
  },
});
