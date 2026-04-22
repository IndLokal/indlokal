/**
 * Suggest a community — PRD-0009.
 * Lightest-weight submit path: name + city + optional note.
 * Posts to POST /api/v1/submissions/suggest.
 */

import { useEffect, useState } from 'react';
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
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discovery as d, submit as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

export default function SuggestCommunityScreen() {
  const [cities, setCities] = useState<d.City[]>([]);
  const [citySlug, setCitySlug] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const cached = await AsyncStorage.getItem(SELECTED_CITY_KEY);
      if (cached) setCitySlug(cached);
      try {
        const list = await queryCache(
          'cities:list',
          () => authClient.getPublic<d.City[]>('/api/v1/cities'),
          { ttl: 5 * 60 * 1000 },
        );
        setCities(list.map((c) => d.City.parse(c)));
        if (!cached && list.length > 0) {
          const first = list.find((c) => c.isActive) ?? list[0];
          if (first) setCitySlug(first.slug);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const canSubmit = name.trim().length >= 2 && citySlug.length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload: s.SuggestSubmission = {
        name: name.trim(),
        citySlug,
        note: note.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      };
      const validated = s.SuggestSubmission.parse(payload);
      await authClient.postAuthed<s.SuggestSubmission, s.SubmissionResult>(
        '/api/v1/submissions/suggest',
        validated as unknown as s.SuggestSubmission & Record<string, unknown>,
      );
      Alert.alert('Thanks!', "We'll look into it.", [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Could not submit', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Suggest a community' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.label}>Community name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Hindi Cinema Club Hamburg"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
          />

          <Text style={styles.label}>City *</Text>
          <View style={styles.chipRow}>
            {cities
              .filter((c) => c.isActive)
              .map((c) => {
                const active = c.slug === citySlug;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCitySlug(c.slug)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                  </Pressable>
                );
              })}
          </View>

          <Text style={styles.label}>What should we know?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A link, a contact, anything that helps."
            style={[styles.input, styles.textarea]}
            placeholderTextColor={palette.neutral.muted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Your email (optional)</Text>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="So we can follow up"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={[styles.primary, !canSubmit && styles.primaryDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Send suggestion</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  label: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.badge,
    backgroundColor: palette.neutral.mutedBg,
  },
  chipActive: { backgroundColor: palette.brand[600] },
  chipText: { fontSize: typography.small, color: palette.neutral.foreground, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  primary: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.brand[600],
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
