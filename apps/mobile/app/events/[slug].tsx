/**
 * Mobile event detail — PRD-0005.
 * Renders the full event with save / share / register / add-to-calendar actions.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { events as e } from '@indlokal/shared';
import { authClient, AuthClientError } from '@/lib/auth/client.expo';
import { invalidatePrefix, queryCache } from '@/lib/cache/query-cache';
import { getApiBaseUrl } from '@/lib/config/api-base-url';
import { cancelEventReminder, hasEventReminder, scheduleEventReminder } from '@/lib/notifications';
import { palette, radius, spacing, typography } from '@/constants/theme';

const PUBLIC_BASE_URL = getApiBaseUrl();

type EventDetailWithSaved = e.EventDetail & { savedByUser?: boolean };

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [data, setData] = useState<EventDetailWithSaved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setError(null);
    try {
      // Try authed first to get savedByUser; fall back to public on 401.
      const path = `/api/v1/events/${encodeURIComponent(slug)}`;
      const tokens = await authClient.getTokens();
      const fetcher = tokens?.accessToken
        ? () => authClient.getAuthed<EventDetailWithSaved>(path)
        : () => authClient.getPublic<EventDetailWithSaved>(path);
      const res = await queryCache(`event:${slug}`, fetcher, { ttl: 2 * 60 * 1000 });
      const parsed = e.EventDetail.parse(res);
      setData({ ...parsed, savedByUser: (res as EventDetailWithSaved).savedByUser });
      setReminderOn(await hasEventReminder(parsed.id));
    } catch (err) {
      setError(err instanceof AuthClientError ? err.message : 'Could not load event.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSave() {
    if (!data) return;
    const tokens = await authClient.getTokens();
    if (!tokens?.accessToken) {
      Alert.alert('Sign in needed', 'Sign in to save events and get reminders.');
      return;
    }
    setBusy(true);
    const desired = !data.savedByUser;
    try {
      const path = `/api/v1/events/${encodeURIComponent(data.slug)}/save`;
      if (desired) {
        await authClient.postAuthed<Record<string, never>, e.SaveState>(path, {});
      } else {
        await authClient.deleteAuthed<e.SaveState>(path);
      }
      setData({ ...data, savedByUser: desired });
      invalidatePrefix('bookmarks:');
      // PRD-0005: schedule a local reminder 1h before start when saving.
      if (desired) {
        const result = await scheduleEventReminder(data.id, data.title, data.startsAt);
        setReminderOn(result === 'scheduled');
      } else {
        await cancelEventReminder(data.id);
        setReminderOn(false);
      }
    } catch {
      Alert.alert('Could not update save', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function openMaps() {
    if (!data) return;
    const query = data.venueAddress ?? data.venueName;
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const url =
      Platform.OS === 'ios' ? `http://maps.apple.com/?q=${encoded}` : `geo:0,0?q=${encoded}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  }

  async function onShare() {
    if (!data) return;
    const url = `${PUBLIC_BASE_URL}/${data.city.slug}/events/${data.slug}`;
    try {
      await Share.share({ message: `${data.title}\n${url}`, url });
    } catch {
      // user cancelled
    }
  }

  async function onRegister() {
    if (!data?.registrationUrl && !data?.onlineUrl) return;
    const url = data.registrationUrl ?? data.onlineUrl ?? '';
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert("Couldn't open link", url);
  }

  async function onCalendar() {
    if (!data) return;
    // Simple v1: open a Google Calendar template URL.
    const start = new Date(data.startsAt)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const end = new Date(data.endsAt ?? data.startsAt)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: data.title,
      dates: `${start}/${end}`,
      details: data.description ?? '',
      location: data.venueAddress ?? data.venueName ?? '',
    });
    await Linking.openURL(`https://calendar.google.com/calendar/render?${params}`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: data?.title ?? 'Event' }} />
      {!data && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand[600]} />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {data && (
        <ScrollView contentContainerStyle={styles.container}>
          {data.imageUrl && (
            <Image source={{ uri: data.imageUrl }} style={styles.hero} resizeMode="cover" />
          )}
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {new Date(data.startsAt).toLocaleString()}
            {data.endsAt ? ` — ${new Date(data.endsAt).toLocaleTimeString()}` : ''}
          </Text>
          <Text style={styles.meta}>
            {data.isOnline ? 'Online event' : (data.venueName ?? 'Venue TBA')}
            {data.venueAddress ? ` · ${data.venueAddress}` : ''}
          </Text>
          {data.community && <Text style={styles.community}>Hosted by {data.community.name}</Text>}
          {data.cost && <Text style={styles.cost}>{data.cost}</Text>}

          <View style={styles.actionRow}>
            <Pressable
              onPress={toggleSave}
              disabled={busy}
              style={[styles.actionPrimary, data.savedByUser && styles.actionSaved]}
            >
              <Text style={styles.actionPrimaryText}>{data.savedByUser ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={onCalendar} style={styles.actionSecondary}>
              <Text style={styles.actionSecondaryText}>Add to calendar</Text>
            </Pressable>
          </View>

          {data.savedByUser && (
            <Text style={styles.reminderHint}>
              {reminderOn
                ? '⏰ We’ll remind you 1 hour before this starts.'
                : 'Enable notifications in Settings to get a 1-hour reminder.'}
            </Text>
          )}

          {(data.registrationUrl || data.onlineUrl) && (
            <Pressable onPress={onRegister} style={styles.actionLink}>
              <Text style={styles.actionLinkText}>
                {data.registrationUrl ? 'Register' : 'Open event link'}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={onShare} style={styles.actionGhost}>
            <Text style={styles.actionGhostText}>Share</Text>
          </Pressable>

          {data.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.body}>{data.description}</Text>
            </View>
          )}

          {!data.isOnline && (data.venueAddress || data.venueName) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Where</Text>
              <Pressable onPress={openMaps} style={styles.mapCard}>
                <View style={styles.mapPin}>
                  <Ionicons name="location" size={22} color={palette.brand[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapVenue}>{data.venueName ?? data.venueAddress}</Text>
                  {data.venueAddress && data.venueName && (
                    <Text style={styles.mapAddress}>{data.venueAddress}</Text>
                  )}
                  <Text style={styles.mapCta}>Open in Maps</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.neutral.muted} />
              </Pressable>
            </View>
          )}

          {data.relatedEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Related events</Text>
              {data.relatedEvents.slice(0, 5).map((r) => (
                <View key={r.id} style={styles.relatedRow}>
                  <Text style={styles.relatedTitle}>{r.title}</Text>
                  <Text style={styles.relatedMeta}>
                    {new Date(r.startsAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.card,
    backgroundColor: palette.neutral.mutedBg,
  },
  title: { fontSize: typography.h1, fontWeight: '800', color: palette.neutral.foreground },
  meta: { fontSize: typography.body, color: palette.neutral.muted },
  community: { fontSize: typography.body, color: palette.brand[600], fontWeight: '600' },
  cost: { fontSize: typography.small, color: palette.neutral.foreground },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionPrimary: {
    flex: 1,
    backgroundColor: palette.brand[600],
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  actionSaved: { backgroundColor: palette.brand[700] },
  actionPrimaryText: { color: '#fff', fontWeight: '700' },
  actionSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    alignItems: 'center',
    backgroundColor: palette.neutral.surface,
  },
  actionSecondaryText: { color: palette.neutral.foreground, fontWeight: '600' },
  actionLink: {
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.accent[500],
    alignItems: 'center',
  },
  actionLinkText: { color: '#fff', fontWeight: '700' },
  actionGhost: { paddingVertical: spacing.sm, alignItems: 'center' },
  actionGhostText: { color: palette.brand[600], fontWeight: '600' },
  reminderHint: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    marginTop: -spacing.xs,
  },
  mapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.brand[50],
  },
  mapPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapVenue: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  mapAddress: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 2 },
  mapCta: {
    fontSize: typography.small,
    color: palette.brand[600],
    fontWeight: '600',
    marginTop: 4,
  },
  section: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.neutral.foreground },
  body: { fontSize: typography.body, color: palette.neutral.foreground, lineHeight: 22 },
  relatedRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  relatedTitle: { fontSize: typography.body, color: palette.neutral.foreground, fontWeight: '600' },
  relatedMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 2 },
  error: { color: palette.status.destructive },
});
