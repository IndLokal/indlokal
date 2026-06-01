/**
 * Edit profile screen - PRD/TDD-0040.
 *
 * Lets the signed-in member update their display name, interests, and
 * preferred languages. Diffs against the current profile and PATCHes only the
 * changed fields to PATCH /api/v1/me/onboarding, then refreshes AuthContext.
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import type { auth } from '@indlokal/shared';
import { useAuth } from '@/lib/auth/AuthContext';
import { authClient } from '@/lib/auth/client.expo';
import type { AuthUser } from '@/lib/auth/token-store';
import {
  buildProfileUpdate,
  profileToFormValues,
  type ProfileFormError,
  type ProfileFormValues,
} from '@/lib/profile/profile-form';
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const initial = useMemo<ProfileFormValues>(
    () =>
      user
        ? profileToFormValues(user)
        : { displayName: '', personaSegmentsText: '', preferredLanguagesText: '' },
    [user],
  );
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<ProfileFormError[]>([]);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.muted}>You are not signed in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function errorFor(field: keyof ProfileFormValues): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function setField(field: keyof ProfileFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors.length > 0) setErrors((prev) => prev.filter((e) => e.field !== field));
  }

  async function handleSave() {
    if (!user) return;
    const result = buildProfileUpdate(user, values);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    if (result.unchanged || !result.update) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      const updated = await authClient.patchAuthed<
        auth.OnboardingUpdate & Record<string, unknown>,
        AuthUser
      >('/api/v1/me/onboarding', result.update);
      await updateUser(updated);
      track({ event: ANALYTICS_EVENTS.profileUpdated, entityType: undefined });
      router.back();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Please check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Edit profile</Text>

          <Field label="Display name" error={errorFor('displayName')}>
            <TextInput
              style={styles.input}
              value={values.displayName}
              onChangeText={(t) => setField('displayName', t)}
              placeholder="Your name"
              placeholderTextColor={palette.neutral.muted}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field
            label="Interests"
            hint="Separate with commas (e.g. founder, family, student)"
            error={errorFor('personaSegmentsText')}
          >
            <TextInput
              style={[styles.input, styles.multiline]}
              value={values.personaSegmentsText}
              onChangeText={(t) => setField('personaSegmentsText', t)}
              placeholder="founder, newcomer"
              placeholderTextColor={palette.neutral.muted}
              multiline
            />
          </Field>

          <Field
            label="Preferred languages"
            hint="Separate with commas (e.g. en, hi, ta)"
            error={errorFor('preferredLanguagesText')}
          >
            <TextInput
              style={[styles.input, styles.multiline]}
              value={values.preferredLanguagesText}
              onChangeText={(t) => setField('preferredLanguagesText', t)}
              placeholder="en, hi"
              placeholderTextColor={palette.neutral.muted}
              autoCapitalize="none"
              multiline
            />
          </Field>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  flex: { flex: 1 },
  container: { padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: typography.h3, fontWeight: '700', color: palette.neutral.foreground },
  field: { gap: spacing.xs },
  label: { fontSize: typography.small, fontWeight: '600', color: palette.neutral.foreground },
  hint: { fontSize: typography.small, color: palette.neutral.muted },
  input: {
    backgroundColor: palette.neutral.surface,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: palette.neutral.foreground,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  error: { fontSize: typography.small, color: palette.status.destructive },
  saveButton: {
    backgroundColor: palette.brand[600],
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: typography.body },
  muted: { color: palette.neutral.muted, fontSize: typography.body },
});
