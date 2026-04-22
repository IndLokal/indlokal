/**
 * Mobile search results — PRD-0007.
 * Reads `q`, `citySlug`, `type`, `range` from route params, calls
 * GET /api/v1/search, and renders Events + Communities groups.
 * Filter chips can refine type and date range; changes update params
 * via router.setParams so the back-stack stays clean.
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
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { search as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

type RangeKey = 'any' | 'today' | 'week' | 'month';
type TypeKey = 'ALL' | 'EVENT' | 'COMMUNITY';

const RANGE_LABEL: Record<RangeKey, string> = {
  any: 'Any time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

const TYPE_LABEL: Record<TypeKey, string> = {
  ALL: 'All',
  EVENT: 'Events',
  COMMUNITY: 'Communities',
};

function rangeToBounds(range: RangeKey): { from?: string; to?: string } {
  if (range === 'any') return {};
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (range === 'week') end.setDate(end.getDate() + 7);
  if (range === 'month') end.setMonth(end.getMonth() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function SearchResultsScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    citySlug?: string;
    type?: TypeKey;
    range?: RangeKey;
  }>();

  const q = params.q ?? '';
  const citySlug = params.citySlug;
  const type: TypeKey = (params.type as TypeKey) ?? 'ALL';
  const range: RangeKey = (params.range as RangeKey) ?? 'any';

  const [items, setItems] = useState<s.SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = useMemo(() => {
    const sp = new URLSearchParams({ q, type });
    if (citySlug) sp.set('citySlug', citySlug);
    const { from, to } = rangeToBounds(range);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    sp.set('limit', '30');
    return `/api/v1/search?${sp.toString()}`;
  }, [q, citySlug, type, range]);

  const load = useCallback(async () => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await queryCache(
        `search:results:${fetchUrl}`,
        () => authClient.getPublic<s.SearchPage>(fetchUrl),
        { ttl: 60 * 1000 },
      );
      const parsed = s.SearchPage.parse(res);
      setItems(parsed.items);
    } catch {
      setError('Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, q]);

  useEffect(() => {
    void load();
  }, [load]);

  function setType(next: TypeKey) {
    router.setParams({ type: next });
  }
  function setRange(next: RangeKey) {
    router.setParams({ range: next });
  }

  const events = items.filter(
    (it): it is Extract<s.SearchResultItem, { type: 'EVENT' }> => it.type === 'EVENT',
  );
  const communities = items.filter(
    (it): it is Extract<s.SearchResultItem, { type: 'COMMUNITY' }> => it.type === 'COMMUNITY',
  );

  const sections = useMemo(() => {
    const out: Array<
      { kind: 'header'; label: string } | { kind: 'item'; item: s.SearchResultItem }
    > = [];
    if (type !== 'COMMUNITY' && events.length > 0) {
      out.push({ kind: 'header', label: `Events · ${events.length}` });
      events.forEach((item) => out.push({ kind: 'item', item }));
    }
    if (type !== 'EVENT' && communities.length > 0) {
      out.push({ kind: 'header', label: `Communities · ${communities.length}` });
      communities.forEach((item) => out.push({ kind: 'item', item }));
    }
    return out;
  }, [events, communities, type]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: q ? `“${q}”` : 'Results' }} />
      <View style={styles.filters}>
        <View style={styles.chipRow}>
          {(['ALL', 'EVENT', 'COMMUNITY'] as TypeKey[]).map((value) => {
            const active = type === value;
            return (
              <Pressable
                key={value}
                onPress={() => setType(value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {TYPE_LABEL[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chipRow}>
          {(['any', 'today', 'week', 'month'] as RangeKey[]).map((value) => {
            const active = range === value;
            return (
              <Pressable
                key={value}
                onPress={() => setRange(value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {RANGE_LABEL[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading && (
        <ActivityIndicator color={palette.brand[600]} style={{ marginTop: spacing.md }} />
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={sections}
        keyExtractor={(row, idx) =>
          row.kind === 'header' ? `h:${row.label}:${idx}` : `i:${row.item.type}:${row.item.item.id}`
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return <Text style={styles.sectionTitle}>{row.label}</Text>;
          }
          if (row.item.type === 'EVENT') {
            const ev = row.item.item;
            return (
              <Link
                key={ev.id}
                href={{ pathname: '/events/[slug]', params: { slug: ev.slug } }}
                asChild
              >
                <Pressable style={styles.row}>
                  <Text style={styles.rowKind}>EVENT</Text>
                  <Text style={styles.rowTitle}>{ev.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {new Date(ev.startsAt).toLocaleString()}
                    {ev.venueName ? ` · ${ev.venueName}` : ev.isOnline ? ' · Online' : ''}
                  </Text>
                </Pressable>
              </Link>
            );
          }
          const c = row.item.item;
          return (
            <Link
              key={c.id}
              href={{ pathname: '/communities/[slug]', params: { slug: c.slug } }}
              asChild
            >
              <Pressable style={styles.row}>
                <Text style={styles.rowKind}>COMMUNITY</Text>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {c.description ?? c.city.name}
                </Text>
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={
          !loading && q.trim().length >= 2 ? (
            <Text style={styles.empty}>No matches. Try a broader query.</Text>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  filters: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.badge,
    backgroundColor: palette.neutral.mutedBg,
  },
  chipActive: { backgroundColor: palette.brand[600] },
  chipText: { color: palette.neutral.foreground, fontSize: typography.small, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  list: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: {
    fontSize: typography.h4,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    marginBottom: spacing.sm,
  },
  rowKind: { fontSize: 11, fontWeight: '700', color: palette.brand[600], marginBottom: 2 },
  rowTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  rowMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 2 },
  empty: { color: palette.neutral.muted, marginTop: spacing.lg, textAlign: 'center' },
  error: { color: palette.status.destructive, padding: spacing.md },
});
