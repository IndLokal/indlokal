import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography } from '@/constants/theme';

export default function MeTabScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>My account</Text>
        <Link href="/me/profile" style={styles.link}>
          View profile
        </Link>
        <Link href="/settings/notifications" style={styles.link}>
          Notification preferences
        </Link>
        <Link href="/inbox" style={styles.link}>
          Inbox
        </Link>
        <Link href="/resources" style={styles.link}>
          City resources
        </Link>
        <Link href="/submit" style={styles.link}>
          Submit an event or community
        </Link>
        <Link href="/me/delete-account" style={styles.link}>
          Delete account
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
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  link: {
    paddingVertical: spacing.md,
    borderBottomColor: palette.neutral.border,
    borderBottomWidth: 1,
    color: palette.brand[700],
    fontWeight: '600',
  },
});
