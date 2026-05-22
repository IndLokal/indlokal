/**
 * Me tab — PRD-0019 / TDD-0019.
 * Auth-aware: anonymous users see a sign-in CTA; signed-in users see
 * account links and a sign-out action.
 */

import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useAuth } from '@/lib/auth/AuthContext';
import { palette, spacing, typography } from '@/constants/theme';

export default function MeTabScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/sign-in');
        },
      },
    ]);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>My account</Text>
          <Text style={styles.anonBody}>
            Sign in to save communities, follow events, and get reminders for what&apos;s happening
            in your city.
          </Text>
          <Pressable style={styles.signInButton} onPress={() => router.push('/auth/sign-in')}>
            <Text style={styles.signInButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>My account</Text>
        {user.displayName ? (
          <Text style={styles.displayName}>{user.displayName}</Text>
        ) : (
          <Text style={styles.email}>{user.email}</Text>
        )}

        <View style={styles.links}>
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
          <Link href="/me/delete-account" style={[styles.link, styles.linkDestructive]}>
            Delete account
          </Link>
        </View>

        <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
  displayName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: palette.brand[700],
  },
  email: {
    fontSize: typography.small,
    color: palette.neutral.muted,
  },
  links: {
    flex: 1,
    gap: 0,
  },
  link: {
    paddingVertical: spacing.md,
    borderBottomColor: palette.neutral.border,
    borderBottomWidth: 1,
    color: palette.brand[700],
    fontWeight: '600',
    fontSize: typography.body,
  },
  linkDestructive: {
    color: palette.status.destructive,
  },
  signOutButton: {
    marginTop: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.status.destructive,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    color: palette.status.destructive,
    fontWeight: '700',
    fontSize: typography.body,
  },
  anonBody: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: palette.brand[600],
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
});
