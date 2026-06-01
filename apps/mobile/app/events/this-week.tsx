/**
 * Indian events this week - PRD/TDD-0040.
 *
 * Parity with the web /indian-events-this-week surface. Reuses the discovery
 * events feed with a from/to window via the pure `lib/discovery/this-week`
 * module. Defaults to the next 7 days; widens to 30 days when empty so the
 * screen is never blank. No new endpoint required.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack } from 'expo-router';
import { discovery as d } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import {
  bucketForEvent,
  eventsFeedPath,
  fallbackWindow,
  thisWeekWindow,
  type EventBucket,
} from '@/lib/discovery/this-week';
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

const BUCKET_LABEL: Record<EventBucket, string> = {
  today: 'Today & ongoing',
  weekend: 'This weekend',
  later: 'Later this week',
};

const BUCKET_ORDER: EventBucket[] = ['today', 'weekend', 'later'];

type Section = { bucket: EventBucket; label: string; events: d.EventCard[] };

export default function ThisWeekScreen() {
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [events, setEvents] = useState<d.EventCard[]>([]);
  const [widened, setWidened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_CITY_KEY).then((value) => setCitySlug(value ?? 'stuttgart'));
  }, []);

  const load = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const week = thisWeekWindow();
      const weekRes = await queryCache(
        `this-week:${slug}:7`,
        () => authClient.getPublic<d.EventsPage>(eventsFeedPath(slug, week)),
        { ttl: 5 * 60 * 1000 },
      );
      let parsed = d.EventsPage.parse(weekRes).items;
      let didWiden = false;

      if (parsed.length === 0) {
        const wide = fallbackWindow();
        const wideRes = await queryCache(
          `this-week:${slug}:30`,
          () => authClient.getPublic<d.EventsPage>(eventsFeedPath(slug, wide)),
          { ttl: 5 * 60 * 1000 },
        );
        parsed = d.EventsPage.parse(wideRes).items;
        didWiden = true;
      }

      setEvents(parsed);
      setWidened(didWiden);
      track({ event: ANALYTICS_EVENTS.thisWeekViewed, citySlug: slug });
    } catch {
      setError('Could not load events right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (citySlug) void load(citySlug);
  }, [citySlug, load]);

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const byBucket = new Map<EventBucket, d.EventCard[]>();
    for (const event of events) {
      const bucket = bucketForEvent(event, now);
      const list = byBucket.get(bucket) ?? [];
      list.push(event);
      byBucket.set(bucket, list);
    }
    return BUCKET_ORDER.flatMap((bucket) => {
      const list = byBucket.get(bucket);
      if (!list || list.length === 0) return [];
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      return [{ bucket, label: BUCKET_LABEL[bucket], events: list }];
    });
  }, [events]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'This week' }} />
      <FlatList
        data={sections}
        keyExtractor={(section) => section.bucket}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Indian events this week</Text>
            <Text style={styles.sub}>
              {widened
                ? 'Nothing this week yet - here are the next upcoming events.'
                : 'Festivals, meetups, and gatherings happening near you.'}
            </Text>
            {loading && <ActivityIndicator color={palette.brand[600]} style={styles.loading} />}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{item.label}</Text>
            {item.events.map((event) => (
              <Link
                key={event.id}
                href={{ pathname: '/events/[slug]', params: { slug: event.slug } }}
                asChild
              >
                <Pressable style={styles.card}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.cardMeta}>
                    {new Date(event.startsAt).toLocaleString()} ·{' '}
                    {event.isOnline ? 'Online' : (event.venueName ?? 'Venue TBA')}
                  </Text>
                  {event.community && (
                    <Text style={styles.cardCommunity}>by {event.community.name}</Text>
                  )}
                </Pressable>
              </Link>
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>No upcoming events for this city yet.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  title: { fontSize: typography.h2, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted },
  loading: { marginVertical: spacing.lg },
  error: { color: palette.status.destructive },
  empty: { color: palette.neutral.muted, marginTop: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.md },
  groupTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.brand[700] },
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted },
  cardCommunity: { fontSize: typography.small, color: palette.brand[600], fontWeight: '600' },
});
