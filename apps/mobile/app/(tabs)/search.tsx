import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { search as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

/**
 * Mobile search shell — TDD-0007 minimal viable.
 * Calls GET /api/v1/search/suggest as the user types.
 * Full results screen and recent-search persistence to be added later.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<s.Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

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
        const response = await authClient.getPublic<s.Suggestion[]>(
          `/api/v1/search/suggest?q=${encodeURIComponent(trimmed)}`,
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
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed]);

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
        />

        {loading && <ActivityIndicator color={palette.brand[600]} />}
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={suggestions}
          keyExtractor={(item, idx) => `${item.type}:${idx}:${item.text}`}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.kind}>{item.type}</Text>
              <Text style={styles.name}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={
            !loading && trimmed.length >= 2 ? (
              <Text style={styles.empty}>No matches.</Text>
            ) : trimmed.length < 2 ? (
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
});
