/**
 * Profile screen — PRD-0019 / TDD-0019.
 * Displays the authenticated user's profile fetched from GET /api/v1/me.
 */

import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function ProfileScreen() {
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
          <Text style={styles.muted}>You are not signed in.</Text>
          <Pressable style={styles.linkButton} onPress={() => router.replace('/auth/sign-in')}>
            <Text style={styles.linkButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <ProfileRow label="Name" value={user.displayName ?? '—'} />
          <ProfileRow label="Email" value={user.email} />
          {user.cityId && <ProfileRow label="City" value={user.cityId} />}
          {user.personaSegments.length > 0 && (
            <ProfileRow label="Interests" value={user.personaSegments.join(', ')} />
          )}
        </View>

        <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  rowLabel: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: typography.body,
    color: palette.neutral.foreground,
    flex: 1,
    textAlign: 'right',
  },
  signOutButton: {
    backgroundColor: palette.status.destructive,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  muted: {
    color: palette.neutral.muted,
    fontSize: typography.body,
  },
  linkButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: palette.brand[600],
    fontWeight: '700',
    fontSize: typography.body,
  },
});
