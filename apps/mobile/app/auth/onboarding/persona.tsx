/**
 * Onboarding step 2 — persona selection. PRD-0019 / TDD-0019.
 *
 * Multi-select persona chips; on Done calls PATCH /api/v1/me/onboarding
 * with both the cityId (from the previous screen) and the selected
 * personaSegments. Sets onboardingComplete = true server-side.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { auth as authContracts } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { useAuth } from '@/lib/auth/AuthContext';
import { palette, radius, spacing, typography } from '@/constants/theme';

const PERSONA_OPTIONS: { label: string; slug: string }[] = [
  { label: 'New to this city', slug: 'new_arrival' },
  { label: 'Student', slug: 'student' },
  { label: 'Family', slug: 'family' },
  { label: 'Working professional', slug: 'professional' },
];

export default function OnboardingPersonaScreen() {
  const params = useLocalSearchParams<{ cityId?: string }>();
  const cityId = params.cityId;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { onSignIn } = useAuth();

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  async function onDone() {
    setLoading(true);
    try {
      const payload: authContracts.OnboardingUpdate = {
        ...(cityId ? { cityId } : {}),
        personaSegments: Array.from(selected),
      };
      const updated = await authClient.patchAuthed<
        authContracts.OnboardingUpdate,
        authContracts.MeProfile
      >('/api/v1/me/onboarding', payload);
      // Sync in-memory auth state with the updated profile.
      onSignIn(updated);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save preferences';
      Alert.alert('Setup failed', message + '. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.step}>Step 2 of 2</Text>
        <Text style={styles.title}>What best describes you?</Text>
        <Text style={styles.subtitle}>Select all that apply. You can change this later.</Text>

        <View style={styles.options}>
          {PERSONA_OPTIONS.map(({ label, slug }) => {
            const active = selected.has(slug);
            return (
              <Pressable
                key={slug}
                style={[styles.option, active && styles.optionSelected]}
                onPress={() => toggle(slug)}
              >
                <Text style={[styles.optionText, active && styles.optionTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          disabled={loading}
          onPress={() => void onDone()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Done</Text>
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
    justifyContent: 'center',
    gap: spacing.md,
  },
  step: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    fontWeight: '600',
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  subtitle: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    marginTop: -spacing.sm,
  },
  options: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  option: {
    backgroundColor: palette.neutral.surface,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionSelected: {
    borderColor: palette.brand[600],
    backgroundColor: palette.brand[50],
  },
  optionText: {
    fontSize: typography.body,
    color: palette.neutral.foreground,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: palette.brand[700],
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: palette.brand[600],
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
