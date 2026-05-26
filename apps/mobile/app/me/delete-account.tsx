/**
 * Delete account screen - PRD-0019 / TDD-0019.
 * Calls DELETE /api/v1/me, clears session, navigates to sign-in.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { authClient } from '@/lib/auth/client.expo';
import { useAuth } from '@/lib/auth/AuthContext';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function DeleteAccountScreen() {
  const [loading, setLoading] = useState(false);
  const { signOut, user, isLoading } = useAuth();

  // Redirect anonymous users - they have nothing to delete.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, isLoading]);

  if (!user) return null;

  function confirmDelete() {
    Alert.alert(
      'Delete account',
      'This permanently removes your profile and all saved items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void performDelete(),
        },
      ],
    );
  }

  async function performDelete() {
    setLoading(true);
    try {
      await authClient.deleteAuthed('/api/v1/me');
      await signOut();
      router.replace('/auth/sign-in');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Could not delete account', message + '. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Delete account</Text>
        <Text style={styles.text}>
          This permanently removes your profile and saved items. This action cannot be undone.
        </Text>
        <Pressable
          style={[styles.button, loading && styles.disabled]}
          disabled={loading}
          onPress={confirmDelete}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Delete account</Text>
          )}
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
  text: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: palette.status.destructive,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  disabled: {
    opacity: 0.6,
  },
});
