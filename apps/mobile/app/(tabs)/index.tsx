import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discovery as d } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

type FeedState = {
  events: d.EventCard[];
  communities: d.CommunityCard[];
};

export default function DiscoverScreen() {
  const [cities, setCities] = useState<d.City[] | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load cities once.
  useEffect(() => {
    let cancelled = false;
    queryCache('cities:list', () => authClient.getPublic<d.City[]>('/api/v1/cities'), {
      ttl: 5 * 60 * 1000,
    })
      .then((response) => {
        if (cancelled) return;
        const parsed = response.map((c) => d.City.parse(c));
        setCities(parsed);
        setCitiesError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setCitiesError('Could not load cities. Pull to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load persisted city selection on focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(SELECTED_CITY_KEY).then((value) => {
        if (cancelled) return;
        if (value) setSelectedSlug(value);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Default to the first active city if none selected yet.
  useEffect(() => {
    if (selectedSlug || !cities || cities.length === 0) return;
    const firstActive = cities.find((c) => c.isActive) ?? cities[0];
    if (firstActive) {
      setSelectedSlug(firstActive.slug);
      void AsyncStorage.setItem(SELECTED_CITY_KEY, firstActive.slug);
    }
  }, [cities, selectedSlug]);

  const loadFeed = useCallback(async (slug: string, force = false) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const [eventsRes, communitiesRes] = await Promise.all([
        queryCache(
          `feed:events:${slug}`,
          () =>
            authClient.getPublic<d.EventsPage>(
              `/api/v1/discovery/${encodeURIComponent(slug)}/events?limit=10`,
            ),
          { ttl: 5 * 60 * 1000, force },
        ),
        queryCache(
          `feed:communities:${slug}`,
          () =>
            authClient.getPublic<d.CommunitiesPage>(
              `/api/v1/discovery/${encodeURIComponent(slug)}/communities?limit=10`,
            ),
          { ttl: 5 * 60 * 1000, force },
        ),
      ]);
      setFeed({
        events: d.EventsPage.parse(eventsRes).items,
        communities: d.CommunitiesPage.parse(communitiesRes).items,
      });
    } catch {
      setFeedError('Could not load this city right now.');
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    void loadFeed(selectedSlug);
  }, [selectedSlug, loadFeed]);

  async function selectCity(slug: string) {
    setSelectedSlug(slug);
    await AsyncStorage.setItem(SELECTED_CITY_KEY, slug);
  }

  async function onRefresh() {
    if (!selectedSlug) return;
    setRefreshing(true);
    await loadFeed(selectedSlug, true);
    setRefreshing(false);
  }

  const selectedCity = useMemo(
    () => cities?.find((c) => c.slug === selectedSlug) ?? null,
    [cities, selectedSlug],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={feed?.events ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.brand}>IndLokal</Text>
            <Text style={styles.heading}>Discover</Text>
            <Text style={styles.sub}>
              {selectedCity ? `What's alive in ${selectedCity.name}` : 'Pick a city to begin'}
            </Text>

            {citiesError && <Text style={styles.errorText}>{citiesError}</Text>}

            {cities && cities.length > 0 && (
              <View style={styles.cityRow}>
                {cities
                  .filter((c) => c.isActive)
                  .map((city) => {
                    const active = city.slug === selectedSlug;
                    return (
                      <Pressable
                        key={city.id}
                        onPress={() => selectCity(city.slug)}
                        style={[styles.cityChip, active && styles.cityChipActive]}
                      >
                        <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                          {city.name}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            )}

            {feedLoading && !feed && (
              <ActivityIndicator color={palette.brand[600]} style={styles.loading} />
            )}
            {feedError && <Text style={styles.errorText}>{feedError}</Text>}

            {feed && feed.communities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured communities</Text>
                <View style={styles.communityList}>
                  {feed.communities.slice(0, 5).map((community) => (
                    <View key={community.id} style={styles.communityCard}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      <Text style={styles.communityMeta} numberOfLines={2}>
                        {community.description ?? community.city.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {feed && feed.events.length > 0 && (
              <Text style={styles.sectionTitle}>Upcoming events</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventMeta}>
              {new Date(item.startsAt).toLocaleString()} · {item.venueName ?? 'Online'}
            </Text>
            {item.community && <Text style={styles.eventCommunity}>by {item.community.name}</Text>}
          </View>
        )}
        ListEmptyComponent={
          !feedLoading && feed && feed.events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No upcoming events for this city yet.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Link href="/inbox" style={styles.footerLink}>
              View notifications inbox
            </Link>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  headerSection: { gap: spacing.md, marginBottom: spacing.md },
  brand: { fontSize: typography.small, fontWeight: '600', color: palette.brand[600] },
  heading: { fontSize: typography.h1, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.badge,
    backgroundColor: palette.neutral.mutedBg,
  },
  cityChipActive: { backgroundColor: palette.brand[600] },
  cityChipText: { color: palette.neutral.foreground, fontWeight: '600' },
  cityChipTextActive: { color: '#fff' },
  loading: { marginVertical: spacing.lg },
  errorText: { color: palette.status.destructive, fontSize: typography.small },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.h4,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginTop: spacing.sm,
  },
  communityList: { gap: spacing.sm },
  communityCard: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  communityName: { fontSize: typography.body, fontWeight: '700', color: palette.brand[700] },
  communityMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
  eventCard: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  eventTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  eventMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
  eventCommunity: { fontSize: typography.small, color: palette.brand[600], marginTop: 4 },
  empty: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: palette.neutral.muted },
  footer: { marginTop: spacing.xl, alignItems: 'center' },
  footerLink: { color: palette.brand[600], fontWeight: '600' },
});
