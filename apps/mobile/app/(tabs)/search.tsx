import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { search as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const RECENT_KEY = 'indlokal.search.recent.v1';
const MAX_RECENT = 8;

/**
 * Mobile search shell — TDD-0007.
 * Calls GET /api/v1/search/suggest as the user types, persists recent queries
 * locally, and routes COMMUNITY/EVENT suggestions to the matching detail screen.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<s.Suggestion[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

  // Load recents on mount.
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          setRecents(parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT));
        }
      } catch {
        // ignore corrupt cache
      }
    });
  }, []);

  // Debounced suggest fetch (250 ms per PRD-0007).
  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await queryCache(
          `search:suggest:${trimmed.toLowerCase()}`,
          () =>
            authClient.getPublic<s.Suggestion[]>(
              `/api/v1/search/suggest?q=${encodeURIComponent(trimmed)}`,
            ),
          { ttl: 5 * 60 * 1000 },
        );
        if (cancelled) return;
        setSuggestions(response.map((item) => s.Suggestion.parse(item)));
        setError(null);
      } catch {
        if (cancelled) return;
        setError('Search failed. Try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed]);

  const persistRecent = useCallback(
    async (value: string) => {
      const next = [value, ...recents.filter((r) => r !== value)].slice(0, MAX_RECENT);
      setRecents(next);
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    },
    [recents],
  );

  const clearRecents = useCallback(async () => {
    setRecents([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  const onSelectSuggestion = useCallback(
    async (item: s.Suggestion) => {
      await persistRecent(item.text);
      // The /suggest endpoint returns the entity slug as `text`.
      if (item.type === 'COMMUNITY') {
        router.push({ pathname: '/communities/[slug]', params: { slug: item.text } });
      } else if (item.type === 'EVENT') {
        router.push({ pathname: '/events/[slug]', params: { slug: item.text } });
      } else {
        setQuery(item.text);
      }
    },
    [persistRecent],
  );

  const onSelectRecent = useCallback((value: string) => {
    setQuery(value);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Communities, events, cities..."
          placeholderTextColor={palette.neutral.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (trimmed.length >= 2) void persistRecent(trimmed);
          }}
        />

        {loading && <ActivityIndicator color={palette.brand[600]} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {trimmed.length < 2 && recents.length > 0 && (
          <View style={styles.recents}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle}>Recent</Text>
              <Pressable onPress={clearRecents}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              {recents.map((value) => (
                <Pressable key={value} onPress={() => onSelectRecent(value)} style={styles.chip}>
                  <Text style={styles.chipText}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <FlatList
          data={suggestions}
          keyExtractor={(item, idx) => `${item.type}:${idx}:${item.text}`}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelectSuggestion(item)} style={styles.row}>
              <Text style={styles.kind}>{item.type}</Text>
              <Text style={styles.name}>{item.text}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading && trimmed.length >= 2 ? (
              <Text style={styles.empty}>No matches.</Text>
            ) : trimmed.length < 2 && recents.length === 0 ? (
              <Text style={styles.empty}>Type at least 2 characters.</Text>
            ) : null
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
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  kind: { fontSize: 11, fontWeight: '700', color: palette.brand[600], marginBottom: 2 },
  name: { fontSize: typography.body, color: palette.neutral.foreground },
  empty: { color: palette.neutral.muted, marginTop: spacing.md },
  error: { color: palette.status.destructive },
  recents: { gap: spacing.sm },
  recentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentsTitle: { fontSize: typography.small, color: palette.neutral.muted, fontWeight: '700' },
  clearLink: { fontSize: typography.small, color: palette.brand[600], fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.badge,
    backgroundColor: palette.neutral.mutedBg,
  },
  chipText: { color: palette.neutral.foreground, fontSize: typography.small, fontWeight: '600' },
});
