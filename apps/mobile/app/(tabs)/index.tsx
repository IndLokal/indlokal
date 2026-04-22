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
import { LogoMark } from '@/components/Logo';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

type FeedState = {
  events: d.EventCard[];
  communities: d.CommunityCard[];
  trending: d.TrendingResponse | null;
};

type DiscoverTab = 'events' | 'communities' | 'trending';

const TABS: Array<{ id: DiscoverTab; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'communities', label: 'Communities' },
  { id: 'trending', label: 'For you' },
];

export default function DiscoverScreen() {
  const [cities, setCities] = useState<d.City[] | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<DiscoverTab>('events');

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
      const [eventsRes, communitiesRes, trendingRes] = await Promise.all([
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
        queryCache(
          `feed:trending:${slug}`,
          () =>
            authClient.getPublic<d.TrendingResponse>(
              `/api/v1/discovery/${encodeURIComponent(slug)}/trending`,
            ),
          { ttl: 5 * 60 * 1000, force },
        ).catch(() => null),
      ]);
      setFeed({
        events: d.EventsPage.parse(eventsRes).items,
        communities: d.CommunitiesPage.parse(communitiesRes).items,
        trending: trendingRes ? d.TrendingResponse.parse(trendingRes) : null,
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

  type FeedRow =
    | { kind: 'event'; item: d.EventCard }
    | { kind: 'community'; item: d.CommunityCard };

  const rows = useMemo<FeedRow[]>(() => {
    if (!feed) return [];
    if (tab === 'events') return feed.events.map((item) => ({ kind: 'event' as const, item }));
    if (tab === 'communities')
      return feed.communities.map((item) => ({ kind: 'community' as const, item }));
    if (!feed.trending) return [];
    return [
      ...feed.trending.events.map((item) => ({ kind: 'event' as const, item })),
      ...feed.trending.communities.map((item) => ({ kind: 'community' as const, item })),
    ];
  }, [feed, tab]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.kind}:${row.item.id}`}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <View style={styles.brandRow}>
              <LogoMark size={32} />
              <Text style={styles.brand}>IndLokal</Text>
            </View>
            <Text style={styles.heading}>Discover</Text>
            <Text style={styles.sub}>
              {selectedCity
                ? `Communities, events, and resources alive in ${selectedCity.name}`
                : 'Pick a city to find communities, events, and resources'}
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

            {feed?.trending && feed.trending.communities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trending right now</Text>
                <FlatList
                  data={feed.trending.communities.slice(0, 8)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.rail}
                  renderItem={({ item }) => (
                    <Link
                      href={{ pathname: '/communities/[slug]', params: { slug: item.slug } }}
                      asChild
                    >
                      <Pressable style={styles.railCard}>
                        <Text style={styles.railBadge}>Trending</Text>
                        <Text style={styles.railTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.railMeta} numberOfLines={2}>
                          {item.description ?? item.city.name}
                        </Text>
                      </Pressable>
                    </Link>
                  )}
                />
              </View>
            )}

            <View style={styles.tabRow}>
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTab(t.id)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {feedLoading && !feed && (
              <ActivityIndicator color={palette.brand[600]} style={styles.loading} />
            )}
            {feedError && <Text style={styles.errorText}>{feedError}</Text>}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'event' ? (
            <Link href={{ pathname: '/events/[slug]', params: { slug: item.item.slug } }} asChild>
              <Pressable style={styles.eventCard}>
                <Text style={styles.eventTitle}>{item.item.title}</Text>
                <Text style={styles.eventMeta}>
                  {new Date(item.item.startsAt).toLocaleString()} ·{' '}
                  {item.item.venueName ?? 'Online'}
                </Text>
                {item.item.community && (
                  <Text style={styles.eventCommunity}>by {item.item.community.name}</Text>
                )}
              </Pressable>
            </Link>
          ) : (
            <Link
              href={{ pathname: '/communities/[slug]', params: { slug: item.item.slug } }}
              asChild
            >
              <Pressable style={styles.communityCard}>
                <Text style={styles.communityName}>{item.item.name}</Text>
                <Text style={styles.communityMeta} numberOfLines={2}>
                  {item.item.description ?? item.item.city.name}
                </Text>
              </Pressable>
            </Link>
          )
        }
        ListEmptyComponent={
          !feedLoading && feed && rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nothing to show for this view yet.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Link href="/resources" style={styles.footerLink}>
              Browse city resources
            </Link>
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brand: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.brand[600],
    letterSpacing: 0.2,
  },
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
  rail: { gap: spacing.sm, paddingRight: spacing.lg },
  railCard: {
    width: 220,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.brand[50],
    marginRight: spacing.sm,
    gap: 4,
  },
  railBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: palette.accent[700],
    backgroundColor: palette.accent[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
    overflow: 'hidden',
  },
  railTitle: { fontSize: typography.body, fontWeight: '700', color: palette.brand[700] },
  railMeta: { fontSize: typography.small, color: palette.neutral.muted },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: palette.neutral.mutedBg,
    padding: spacing.xs,
    borderRadius: radius.button,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.button,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: typography.small, fontWeight: '600', color: palette.neutral.muted },
  tabTextActive: { color: palette.brand[700] },
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
