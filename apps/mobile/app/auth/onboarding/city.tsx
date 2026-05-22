/**
 * Onboarding step 1 — city selection. PRD-0019 / TDD-0019.
 *
 * Fetches active cities from GET /api/v1/cities and presents a filtered
 * list. The selected cityId is passed as a route param to the persona
 * screen, which POSTs both in a single PATCH /api/v1/me/onboarding call.
 */

import { useEffect, useMemo, useState } from 'react';
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
import { discovery as d } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function OnboardingCityScreen() {
  const [cities, setCities] = useState<d.City[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadCities() {
    setLoading(true);
    setFetchError(false);
    try {
      const raw = await authClient.getPublic<d.City[]>('/api/v1/cities');
      const parsed = d.City.array().parse(raw);
      setCities(parsed.filter((c) => c.isActive));
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCities();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q),
    );
  }, [cities, query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.step}>Step 1 of 2</Text>
        <Text style={styles.title}>Which city are you in?</Text>

        <TextInput
          placeholder="Search cities…"
          placeholderTextColor={palette.neutral.muted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        {loading && <ActivityIndicator color={palette.brand[600]} style={styles.spinner} />}

        {fetchError && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Could not load cities.</Text>
            <Pressable onPress={() => void loadCities()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !fetchError && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  style={[styles.cityRow, selected && styles.cityRowSelected]}
                  onPress={() => setSelectedId(item.id)}
                >
                  <Text style={[styles.cityName, selected && styles.cityNameSelected]}>
                    {item.name}
                  </Text>
                  <Text style={styles.cityState}>{item.state}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No cities match "{query}".</Text>}
          />
        )}

        <Pressable
          disabled={!selectedId}
          style={[styles.button, !selectedId && styles.disabled]}
          onPress={() =>
            router.push({ pathname: '/auth/onboarding/persona', params: { cityId: selectedId! } })
          }
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.neutral.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  step: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginBottom: spacing.md,
  },
  search: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
    fontSize: typography.body,
    marginBottom: spacing.sm,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
  },
  cityRowSelected: {
    borderColor: palette.brand[600],
    backgroundColor: palette.brand[50] ?? palette.neutral.surface,
  },
  cityName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: palette.neutral.foreground,
  },
  cityNameSelected: {
    color: palette.brand[700],
  },
  cityState: {
    fontSize: typography.small,
    color: palette.neutral.muted,
  },
  empty: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  errorBox: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorText: {
    color: palette.status.destructive,
    fontSize: typography.body,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.brand[600],
  },
  retryText: {
    color: palette.brand[600],
    fontWeight: '700',
    fontSize: typography.body,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: palette.brand[600],
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  disabled: {
    opacity: 0.5,
  },
});
