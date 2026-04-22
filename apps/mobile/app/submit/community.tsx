/**
 * Submit community form — PRD-0009.
 * Text-only v1. Posts to POST /api/v1/submissions/community.
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
import { community as c, discovery as d, submit as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

const CHANNEL_LABEL: Record<c.ChannelType, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  EMAIL: 'Email',
  MEETUP: 'Meetup',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  OTHER: 'Other',
};

const CHANNEL_VALUES = Object.keys(CHANNEL_LABEL) as c.ChannelType[];

export default function SubmitCommunityScreen() {
  const [cities, setCities] = useState<d.City[]>([]);
  const [citySlug, setCitySlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoriesText, setCategoriesText] = useState('');
  const [primaryChannelType, setPrimaryChannelType] = useState<c.ChannelType>('WHATSAPP');
  const [primaryChannelUrl, setPrimaryChannelUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
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
        setCities(list.map((city) => d.City.parse(city)));
        if (!cached && list.length > 0) {
          const first = list.find((city) => city.isActive) ?? list[0];
          if (first) setCitySlug(first.slug);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const categories = categoriesText
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const canSubmit =
    name.trim().length >= 2 &&
    description.trim().length >= 10 &&
    citySlug.length > 0 &&
    categories.length > 0 &&
    primaryChannelUrl.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    contactName.trim().length > 0 &&
    !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload: s.CommunitySubmission = {
        name: name.trim(),
        description: description.trim(),
        citySlug,
        categories,
        languages: [],
        primaryChannelType,
        primaryChannelUrl: primaryChannelUrl.trim(),
        contactEmail: contactEmail.trim(),
        contactName: contactName.trim(),
      };
      const validated = s.CommunitySubmission.parse(payload);
      const result = await authClient.postAuthed<s.CommunitySubmission, s.SubmissionResult>(
        '/api/v1/submissions/community',
        validated as unknown as s.CommunitySubmission & Record<string, unknown>,
      );
      Alert.alert(
        'Thanks!',
        `Submitted (status: ${result.status}). Our team reviews each community before it goes live.`,
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
      <Stack.Screen options={{ title: 'Add community' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.label}>Community name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tamil Sangam Stuttgart"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
          />

          <Text style={styles.label}>City *</Text>
          <View style={styles.chipRow}>
            {cities
              .filter((city) => city.isActive)
              .map((city) => {
                const active = city.slug === citySlug;
                return (
                  <Pressable
                    key={city.id}
                    onPress={() => setCitySlug(city.slug)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {city.name}
                    </Text>
                  </Pressable>
                );
              })}
          </View>

          <Text style={styles.label}>Categories *</Text>
          <TextInput
            value={categoriesText}
            onChangeText={setCategoriesText}
            placeholder="culture, language"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
          />
          <Text style={styles.help}>Comma-separated category slugs.</Text>

          <Text style={styles.label}>Description *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What does this community do? (min 10 chars)"
            style={[styles.input, styles.textarea]}
            placeholderTextColor={palette.neutral.muted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Primary channel *</Text>
          <View style={styles.chipRow}>
            {CHANNEL_VALUES.map((value) => {
              const active = value === primaryChannelType;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPrimaryChannelType(value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {CHANNEL_LABEL[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={primaryChannelUrl}
            onChangeText={setPrimaryChannelUrl}
            placeholder="https://chat.whatsapp.com/..."
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.label}>Contact name *</Text>
          <TextInput
            value={contactName}
            onChangeText={setContactName}
            placeholder="Who can we reach?"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
          />

          <Text style={styles.label}>Contact email *</Text>
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
