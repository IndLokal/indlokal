import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { resources as r } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

type Tab = 'events' | 'communities';

type CardItem = {
  id: string;
  slug: string;
  primary: string;
  secondary: string | null;
  kind: Tab;
};

/**
 * Mobile bookmarks shell — TDD-0010.
 * Lists the signed-in user's saved events and communities.
 */
export default function BookmarksScreen() {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<r.SavedEventsPage | null>(null);
  const [communities, setCommunities] = useState<r.SavedCommunitiesPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'events') {
        const res = await queryCache(
          'bookmarks:events',
          () => authClient.getAuthed<r.SavedEventsPage>('/api/v1/me/saves/events'),
          { ttl: 60 * 1000 },
        );
        setEvents(r.SavedEventsPage.parse(res));
      } else {
        const res = await queryCache(
          'bookmarks:communities',
          () => authClient.getAuthed<r.SavedCommunitiesPage>('/api/v1/me/saves/communities'),
          { ttl: 60 * 1000 },
        );
        setCommunities(r.SavedCommunitiesPage.parse(res));
      }
    } catch {
      setError('Sign in to view your saved items.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const items: ReadonlyArray<CardItem> =
    tab === 'events'
      ? (events?.items ?? []).map((e) => ({
          id: e.id,
          slug: e.slug,
          primary: e.title,
          secondary: new Date(e.startsAt).toLocaleString(),
          kind: 'events' as const,
        }))
      : (communities?.items ?? []).map((c) => ({
          id: c.id,
          slug: c.slug,
          primary: c.name,
          secondary: c.description,
          kind: 'communities' as const,
        }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Saved</Text>

        <View style={styles.tabRow}>
          {(['events', 'communities'] as Tab[]).map((value) => {
            const active = value === tab;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{value}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading && <ActivityIndicator color={palette.brand[600]} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Link
              href={
                item.kind === 'events'
                  ? { pathname: '/events/[slug]', params: { slug: item.slug } }
                  : { pathname: '/communities/[slug]', params: { slug: item.slug } }
              }
              asChild
            >
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{item.primary}</Text>
                {item.secondary && <Text style={styles.cardMeta}>{item.secondary}</Text>}
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={
            !loading && !error ? <Text style={styles.empty}>Nothing saved yet.</Text> : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: typography.h1, fontWeight: '800', color: palette.neutral.foreground },
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.badge,
    backgroundColor: palette.neutral.mutedBg,
  },
  tabActive: { backgroundColor: palette.brand[600] },
  tabText: { color: palette.neutral.foreground, fontWeight: '600', textTransform: 'capitalize' },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
  empty: { color: palette.neutral.muted },
  error: { color: palette.status.destructive },
});
