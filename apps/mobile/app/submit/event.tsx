/**
 * Submit event form — PRD-0009.
 * Text-only v1 (no image picker yet — pending expo-image-picker install).
 * Posts to POST /api/v1/submissions/event with EventSubmission shape.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function SubmitEventScreen() {
  const [cities, setCities] = useState<d.City[]>([]);
  const [citySlug, setCitySlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [cost, setCost] = useState('');
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
        // ignore — user can still pick from default
      }
    })();
  }, []);

  const startsIso = useMemo(() => toIsoOrNull(startsAt), [startsAt]);
  const endsIso = useMemo(() => (endsAt ? toIsoOrNull(endsAt) : null), [endsAt]);

  const canSubmit = title.trim().length >= 3 && citySlug.length > 0 && startsIso !== null && !busy;

  async function onSubmit() {
    if (!canSubmit || !startsIso) return;
    setBusy(true);
    try {
      const payload: s.EventSubmission = {
        title: title.trim(),
        description: description.trim() || undefined,
        citySlug,
        startsAt: startsIso,
        endsAt: endsIso ?? undefined,
        venueName: venueName.trim() || undefined,
        venueAddress: venueAddress.trim() || undefined,
        isOnline,
        cost: cost.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      };
      const validated = s.EventSubmission.parse(payload);
      const result = await authClient.postAuthed<s.EventSubmission, s.SubmissionResult>(
        '/api/v1/submissions/event',
        validated as unknown as s.EventSubmission & Record<string, unknown>,
      );
      Alert.alert(
        'Thanks!',
        `Your event was submitted (status: ${result.status}). We'll notify you when it's reviewed.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Could not submit', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Submit event' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.label}>Event title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Diwali Mela 2026"
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

          <Text style={styles.label}>Starts at *</Text>
          <TextInput
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="2026-11-12 18:00"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
          />
          <Text style={styles.help}>
            ISO date/time (YYYY-MM-DD HH:mm). Local time zone assumed.
          </Text>

          <Text style={styles.label}>Ends at</Text>
          <TextInput
            value={endsAt}
            onChangeText={setEndsAt}
            placeholder="2026-11-12 22:00"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
          />

          <View style={styles.row}>
            <Text style={styles.label}>Online event</Text>
            <Switch value={isOnline} onValueChange={setIsOnline} />
          </View>

          {!isOnline && (
            <>
              <Text style={styles.label}>Venue name</Text>
              <TextInput
                value={venueName}
                onChangeText={setVenueName}
                placeholder="Liederhalle Stuttgart"
                style={styles.input}
                placeholderTextColor={palette.neutral.muted}
              />
              <Text style={styles.label}>Venue address</Text>
              <TextInput
                value={venueAddress}
                onChangeText={setVenueAddress}
                placeholder="Berliner Platz 1, 70174 Stuttgart"
                style={styles.input}
                placeholderTextColor={palette.neutral.muted}
              />
            </>
          )}

          <Text style={styles.label}>Cost</Text>
          <TextInput
            value={cost}
            onChangeText={setCost}
            placeholder="Free / €15"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is the event about?"
            style={[styles.input, styles.textarea]}
            placeholderTextColor={palette.neutral.muted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Contact email</Text>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="organizer@example.com"
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
              <Text style={styles.primaryText}>Submit for review</Text>
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
  help: { fontSize: 12, color: palette.neutral.muted },
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
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
