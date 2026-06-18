/**
 * Me tab - PRD-0019 / TDD-0019.
 * Auth-aware: anonymous users see a sign-in CTA; signed-in users see
 * account links and a sign-out action.
 */

import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, Pressable, View } from 'react-native';
import { auth } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { describeAuthError } from '@/lib/auth/auth-errors';
import { useAuth } from '@/lib/auth/AuthContext';
import { exportMeDataToFile } from '@/lib/auth/me-export.expo';
import { useWebHandoff } from '@/lib/auth/web-handoff.expo';
import type { AuthUser } from '@/lib/auth/token-store';
import { mobileFlags } from '@/lib/config/flags';
import { palette, spacing, typography } from '@/constants/theme';

type WorkspaceEntry = {
  key: string;
  title: string;
  description: string;
  next: string;
};

function getWorkspaceEntries(user: AuthUser): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [];

  // Backward-compat: older cached auth payloads may not have these fields
  // until /api/v1/me refreshes the profile shape.
  const roleAssignments = user.roleAssignments ?? [];
  const claimedCommunities = user.claimedCommunities ?? [];

  const activeAssignments = roleAssignments.filter((a) => !a.revokedAt);
  const isAdminLike = user.role === 'PLATFORM_ADMIN' || user.role === 'OPS_LEAD';
  const hasOrganizerAccess =
    user.role === 'COMMUNITY_ADMIN' ||
    user.role === 'PARTNER_ORG_ADMIN' ||
    user.role === 'PLATFORM_ADMIN' ||
    activeAssignments.some((a) => a.role === 'COMMUNITY_ADMIN' || a.role === 'PARTNER_ORG_ADMIN') ||
    claimedCommunities.length > 0;
  const hasHostAccess =
    user.role === 'EVENT_HOST' ||
    user.role === 'PLATFORM_ADMIN' ||
    activeAssignments.some((a) => a.role === 'EVENT_HOST');
  const hasAmbassadorAccess =
    isAdminLike ||
    user.role === 'CITY_AMBASSADOR' ||
    activeAssignments.some((a) => a.role === 'CITY_AMBASSADOR');
  const hasAdminAccess =
    isAdminLike ||
    user.role === 'PLATFORM_ADMIN' ||
    user.role === 'PARTNERSHIPS_LEAD' ||
    activeAssignments.some(
      (a) => a.role === 'PLATFORM_ADMIN' || a.role === 'OPS_LEAD' || a.role === 'PARTNERSHIPS_LEAD',
    );

  if (hasOrganizerAccess) {
    entries.push({
      key: 'organizer',
      title: 'Organizer workspace',
      description: 'Manage community profile, events, and collaborators.',
      next: '/organizer',
    });
  }

  if (hasHostAccess) {
    entries.push({
      key: 'host',
      title: 'Event Host workspace',
      description: 'Manage host profile and event lifecycle.',
      next: '/organizer/host',
    });
  }

  if (hasAmbassadorAccess) {
    entries.push({
      key: 'ambassador',
      title: 'Ambassador console',
      description: 'Track city submissions and field operations.',
      next: '/ambassador',
    });
  }

  if (hasAdminAccess) {
    entries.push({
      key: 'admin',
      title: 'Admin console',
      description: 'Moderation, pipeline, and back-office operations.',
      next: '/admin',
    });
  }

  return entries;
}

export default function MeTabScreen() {
  const { user, signOut } = useAuth();
  const { open, isOpening, error } = useWebHandoff(authClient);
  const [workspaceUser, setWorkspaceUser] = useState<AuthUser | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setWorkspaceUser(null);
      return () => {
        cancelled = true;
      };
    }

    setWorkspaceUser(user);

    void (async () => {
      try {
        const profile = await authClient.getAuthed<auth.MeProfile>('/api/v1/me');
        const parsed = auth.MeProfile.parse(profile);
        if (!cancelled) {
          setWorkspaceUser(parsed);
        }
      } catch {
        // Fall back to token-stored user when /me refresh is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  async function handleOpenWeb() {
    const ok = await open({ next: '/me' });
    if (!ok) {
      Alert.alert('Open web failed', error ?? 'Please try again.');
    }
  }

  async function handleWorkspaceOpen(next: string, title: string) {
    if (!mobileFlags.auth.webHandoff.enabled) {
      Alert.alert('Unavailable', 'Web workspace hand-off is not enabled in this environment.');
      return;
    }

    const ok = await open({ next });
    if (!ok) {
      Alert.alert(`${title} unavailable`, error ?? 'Please try again.');
    }
  }

  async function handleExportData() {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const file = await exportMeDataToFile(authClient);
      Alert.alert(
        'Data export ready',
        `Saved ${file.fileName} (${file.sizeBytes} bytes) to local app storage.`,
      );
    } catch (err) {
      Alert.alert('Data export failed', describeAuthError(err, 'session'));
    } finally {
      setIsExporting(false);
    }
  }

  const workspaces = workspaceUser ? getWorkspaceEntries(workspaceUser) : [];

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

        {workspaces.length > 0 ? (
          <View style={styles.workspaceSection}>
            <Text style={styles.sectionLabel}>Workspaces</Text>
            <Text style={styles.workspaceBody}>
              Continue to role-specific surfaces. Web-only destinations open already signed in.
            </Text>
            <View style={styles.workspaceList}>
              {workspaces.map((workspace) => (
                <Pressable
                  key={workspace.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${workspace.title}`}
                  style={[styles.workspaceCard, isOpening && styles.buttonDisabled]}
                  onPress={() => void handleWorkspaceOpen(workspace.next, workspace.title)}
                  disabled={isOpening}
                >
                  <Text style={styles.workspaceTitle}>{workspace.title}</Text>
                  <Text style={styles.workspaceDescription}>{workspace.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export my data"
            style={[styles.linkPressable, isExporting && styles.buttonDisabled]}
            onPress={() => void handleExportData()}
            disabled={isExporting}
          >
            <Text style={styles.linkButtonText}>
              {isExporting ? 'Preparing data export...' : 'Export my data (JSON)'}
            </Text>
          </Pressable>
        </View>

        {mobileFlags.auth.webHandoff.enabled && workspaces.length === 0 ? (
          <View style={styles.webHandoffCard}>
            <Text style={styles.sectionLabel}>Web-only surfaces</Text>
            <Text style={styles.webHandoffBody}>
              Organizer and admin tools that are not native on mobile open in web already signed in.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open web version"
              style={[styles.webButton, isOpening && styles.buttonDisabled]}
              onPress={() => void handleOpenWeb()}
              disabled={isOpening}
            >
              <Text style={styles.webButtonText}>
                {isOpening ? 'Opening web...' : 'Open web version'}
              </Text>
            </Pressable>
          </View>
        ) : null}

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
  workspaceSection: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
  },
  workspaceBody: {
    color: palette.neutral.muted,
    fontSize: typography.small,
    lineHeight: 20,
  },
  workspaceList: {
    gap: spacing.sm,
  },
  workspaceCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.background,
    padding: spacing.md,
    gap: spacing.xs,
  },
  workspaceTitle: {
    color: palette.neutral.foreground,
    fontSize: typography.body,
    fontWeight: '700',
  },
  workspaceDescription: {
    color: palette.neutral.muted,
    fontSize: typography.small,
    lineHeight: 20,
  },
  webHandoffCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
  },
  sectionLabel: {
    fontSize: typography.small,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: palette.neutral.muted,
  },
  webHandoffBody: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    lineHeight: 24,
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
  linkPressable: {
    paddingVertical: spacing.md,
    borderBottomColor: palette.neutral.border,
    borderBottomWidth: 1,
  },
  linkButtonText: {
    color: palette.brand[700],
    fontWeight: '600',
    fontSize: typography.body,
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
  webButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.brand[600],
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: palette.brand[50],
  },
  webButtonText: {
    color: palette.brand[700],
    fontWeight: '700',
    fontSize: typography.body,
  },
  buttonDisabled: {
    opacity: 0.6,
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
