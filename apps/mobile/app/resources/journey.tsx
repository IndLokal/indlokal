/**
 * Newcomer Journey screen — essentials-only resources grouped by lifecycle
 * stage. PRD/TDD-0030 §6.
 *
 * Mirrors GET /api/v1/cities/:slug/resources/journey.
 *
 * "Checked" state is persisted locally per-city under
 *   resource_journey:v1:{citySlug}
 * (Per the spec, no server sync — purely a client-side checklist UI.)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { resources as r, resourceCategories as rc } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';
const CHECKED_KEY = (citySlug: string) => `resource_journey:v1:${citySlug}`;

type Stage = 'PRE_ARRIVAL' | 'FIRST_30_DAYS' | 'FIRST_90_DAYS' | 'SETTLED' | 'ANYTIME';

const STAGE_ORDER: Stage[] = [
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
];

const STAGE_LABELS: Record<Stage, { title: string; blurb: string; icon: string }> = {
  PRE_ARRIVAL: {
    title: 'Before You Arrive',
    blurb: 'Paperwork to line up while still in India.',
    icon: '✈️',
  },
  FIRST_30_DAYS: {
    title: 'First 30 Days',
    blurb: 'Anmeldung, residence permit, health insurance.',
    icon: '📋',
  },
  FIRST_90_DAYS: {
    title: 'First 90 Days',
    blurb: 'Tax setup, bank accounts, family registration.',
    icon: '🗓️',
  },
  SETTLED: {
    title: 'Settling In',
    blurb: 'Long-term residence and career moves.',
    icon: '🏠',
  },
  ANYTIME: {
    title: 'Anytime',
    blurb: 'Useful any time you live in Germany.',
    icon: '🇩🇪',
  },
};

interface JourneyItem {
  id: string;
  title: string;
  slug: string;
  resourceType: r.ResourceType;
  url: string | null;
  description: string | null;
}

interface JourneyResponse {
  citySlug: string;
  stages: { stage: Stage; items: JourneyItem[] }[];
  unscheduled: JourneyItem[];
}

export default function JourneyScreen() {
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_CITY_KEY).then((value) => {
      setCitySlug(value ?? 'stuttgart');
    });
  }, []);

  const load = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryCache(
        `journey:${slug}`,
        () => authClient.getPublic<JourneyResponse>(
          `/api/v1/cities/${encodeURIComponent(slug)}/resources/journey`,
        ),
        { ttl: 10 * 60 * 1000 },
      );
      setData(res);
      const raw = await AsyncStorage.getItem(CHECKED_KEY(slug));
      if (raw) {
        try {
          const arr = JSON.parse(raw) as string[];
          setChecked(new Set(arr));
        } catch {
          setChecked(new Set());
        }
      } else {
        setChecked(new Set());
      }
    } catch {
      setError('Could not load journey right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (citySlug) void load(citySlug);
  }, [citySlug, load]);

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (citySlug) {
          void AsyncStorage.setItem(
            CHECKED_KEY(citySlug),
            JSON.stringify(Array.from(next)),
          );
        }
        return next;
      });
    },
    [citySlug],
  );

  async function open(url: string | null) {
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert("Couldn't open link", url);
  }

  const populated = useMemo(
    () => (data?.stages ?? []).filter((s) => s.items.length > 0),
    [data],
  );
  const total = useMemo(() => {
    if (!data) return 0;
    return (
      data.stages.reduce((acc, s) => acc + s.items.length, 0) + data.unscheduled.length
    );
  }, [data]);
  const done = checked.size;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Newcomer Journey' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Newcomer Journey</Text>
        <Text style={styles.sub}>
          The official steps Indian newcomers need to complete — grouped by when they
          matter.
        </Text>

        {total > 0 && (
          <Text style={styles.progress}>
            {done} / {total} complete
          </Text>
        )}

        {loading && <ActivityIndicator color={palette.brand[600]} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && total === 0 && (
          <Text style={styles.empty}>No journey items for this city yet.</Text>
        )}

        {populated.map((s) => {
          const meta = STAGE_LABELS[s.stage];
          return (
            <View key={s.stage} style={styles.group}>
              <Text style={styles.groupTitle}>
                {meta.icon}  {meta.title}
              </Text>
              <Text style={styles.groupBlurb}>{meta.blurb}</Text>
              {s.items.map((item) => {
                const cat = rc.RESOURCE_CATEGORIES.find((c) => c.type === item.resourceType);
                const isChecked = checked.has(item.id);
                return (
                  <View key={`${s.stage}-${item.id}`} style={styles.card}>
                    <Pressable
                      onPress={() => toggle(item.id)}
                      hitSlop={8}
                      style={[styles.checkbox, isChecked && styles.checkboxOn]}
                    >
                      {isChecked && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                    <Pressable style={styles.cardBody} onPress={() => open(item.url)}>
                      <Text
                        style={[styles.cardTitle, isChecked && styles.cardTitleDone]}
                        numberOfLines={2}
                      >
                        {cat?.icon ? `${cat.icon}  ` : ''}
                        {item.title}
                      </Text>
                      {item.description && (
                        <Text style={styles.cardMeta} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      {item.url && <Text style={styles.cardLink}>Open link</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        })}

        {data && data.unscheduled.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Other Essentials</Text>
            <Text style={styles.groupBlurb}>Important any time during your stay.</Text>
            {data.unscheduled.map((item) => {
              const isChecked = checked.has(item.id);
              return (
                <View key={`u-${item.id}`} style={styles.card}>
                  <Pressable
                    onPress={() => toggle(item.id)}
                    hitSlop={8}
                    style={[styles.checkbox, isChecked && styles.checkboxOn]}
                  >
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                  <Pressable style={styles.cardBody} onPress={() => open(item.url)}>
                    <Text
                      style={[styles.cardTitle, isChecked && styles.cardTitleDone]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {item.description && (
                      <Text style={styles.cardMeta} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    {item.url && <Text style={styles.cardLink}>Open link</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: typography.h1, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted },
  progress: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.brand[700],
    marginTop: spacing.xs ?? 4,
  },
  loading: { marginVertical: spacing.lg },
  error: { color: palette.status.destructive },
  empty: { color: palette.neutral.muted, marginTop: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.md },
  groupTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.brand[700] },
  groupBlurb: { fontSize: typography.small, color: palette.neutral.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardTitleDone: { textDecorationLine: 'line-through', color: palette.neutral.muted },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
  cardLink: {
    fontSize: typography.small,
    color: palette.brand[600],
    marginTop: 6,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.brand[400] ?? palette.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: palette.brand[600], borderColor: palette.brand[600] },
  checkmark: { color: 'white', fontWeight: '900', fontSize: 14, lineHeight: 16 },
});
