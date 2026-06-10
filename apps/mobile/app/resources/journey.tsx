/**
 * Newcomer Journey screen - essentials-only resources grouped by lifecycle
 * stage. PRD/TDD-0030 §6.
 *
 * Mirrors GET /api/v1/cities/:slug/resources/journey.
 *
 * "Checked" state is persisted locally per-city under
 *   resource_journey:v1:{citySlug}
 * (Per the spec, no server sync - purely a client-side checklist UI.)
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
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { mobileFlags } from '@/lib/config/flags';
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
  validUntil: string | null;
}

interface JourneyResponse {
  citySlug: string;
  stages: { stage: Stage; items: JourneyItem[] }[];
  unscheduled: JourneyItem[];
}

const OFFICIAL_TYPES = new Set<r.ResourceType>([
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
]);

function isStale(validUntil: string | null): boolean {
  if (!validUntil) return false;
  const ts = Date.parse(validUntil);
  return Number.isFinite(ts) && ts < Date.now();
}

function trustLabel(resourceType: r.ResourceType): string {
  return OFFICIAL_TYPES.has(resourceType) ? 'Official' : 'Curated';
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
        () =>
          authClient.getPublic<JourneyResponse>(
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
          void AsyncStorage.setItem(CHECKED_KEY(citySlug), JSON.stringify(Array.from(next)));
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

  const populated = useMemo(() => (data?.stages ?? []).filter((s) => s.items.length > 0), [data]);
  const total = useMemo(() => {
    if (!data) return 0;
    return data.stages.reduce((acc, s) => acc + s.items.length, 0) + data.unscheduled.length;
  }, [data]);
  const done = checked.size;
  const nextAction = useMemo(() => {
    if (!data) return null;
    for (const stage of STAGE_ORDER) {
      const stageBucket = data.stages.find((entry) => entry.stage === stage);
      if (!stageBucket) continue;
      for (const item of stageBucket.items) {
        if (!checked.has(item.id)) return item;
      }
    }
    for (const item of data.unscheduled) {
      if (!checked.has(item.id)) return item;
    }
    return null;
  }, [data, checked]);

  const hasResume = total > 0 && done > 0 && done < total && nextAction !== null;

  useEffect(() => {
    if (!citySlug || !mobileFlags.resources.resumeEnabled || !hasResume || !nextAction) return;
    track({
      event: ANALYTICS_EVENTS.journeyResumePromptShown,
      citySlug,
      metadata: {
        source_surface: 'resources_journey',
        next_action_id: nextAction.id,
        progress_completed: done,
        progress_total: total,
      },
    });
    track({
      event: ANALYTICS_EVENTS.journeyNextActionImpression,
      citySlug,
      metadata: {
        source_surface: 'resources_journey',
        next_action_id: nextAction.id,
      },
    });
    if (mobileFlags.resources.ctaEnabled) {
      track({
        event: ANALYTICS_EVENTS.resourceCtaImpression,
        citySlug,
        metadata: {
          cta_surface: 'resources_journey_next_action',
          cta_position: 'primary',
          variant: 'action_first_v1',
        },
      });
    }
  }, [citySlug, hasResume, nextAction, done, total]);

  const resetProgress = useCallback(() => {
    if (!citySlug) return;
    const empty = new Set<string>();
    setChecked(empty);
    void AsyncStorage.setItem(CHECKED_KEY(citySlug), JSON.stringify(Array.from(empty)));
    track({
      event: ANALYTICS_EVENTS.journeyProgressReset,
      citySlug,
      metadata: { source_surface: 'resources_journey' },
    });
  }, [citySlug]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Newcomer Journey' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Newcomer Journey</Text>
        <Text style={styles.sub}>
          The official steps Indian newcomers need to complete - grouped by when they matter.
        </Text>

        {total > 0 && (
          <View style={styles.progressRow}>
            <Text style={styles.progress}>
              {done} / {total} complete
            </Text>
            {done > 0 && (
              <Pressable onPress={resetProgress} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            )}
          </View>
        )}

        {loading && <ActivityIndicator color={palette.brand[600]} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && total === 0 && (
          <Text style={styles.empty}>No journey items for this city yet.</Text>
        )}

        {mobileFlags.resources.resumeEnabled && nextAction && (
          <View style={styles.nextActionCard}>
            <Text style={styles.nextActionEyebrow}>
              {hasResume ? 'RESUME' : 'NEXT BEST ACTION'}
            </Text>
            <Text style={styles.nextActionTitle}>{nextAction.title}</Text>
            <View style={styles.nextActionActions}>
              <Pressable
                style={styles.nextActionPrimary}
                onPress={() => {
                  if (!citySlug) return;
                  track({
                    event: ANALYTICS_EVENTS.journeyNextActionClick,
                    citySlug,
                    entityType: 'RESOURCE',
                    entityId: nextAction.id,
                    metadata: {
                      source_surface: 'resources_journey',
                      next_action_id: nextAction.id,
                    },
                  });
                  if (hasResume) {
                    track({
                      event: ANALYTICS_EVENTS.journeyResumeClicked,
                      citySlug,
                      entityType: 'RESOURCE',
                      entityId: nextAction.id,
                      metadata: {
                        source_surface: 'resources_journey',
                        next_action_id: nextAction.id,
                      },
                    });
                  }
                  if (mobileFlags.resources.ctaEnabled) {
                    track({
                      event: ANALYTICS_EVENTS.resourceCtaClick,
                      citySlug,
                      entityType: 'RESOURCE',
                      entityId: nextAction.id,
                      metadata: {
                        cta_surface: 'resources_journey_next_action',
                        cta_position: 'primary',
                        variant: 'action_first_v1',
                      },
                    });
                  }
                  void open(nextAction.url);
                }}
              >
                <Text style={styles.nextActionPrimaryText}>Continue next step</Text>
              </Pressable>

              <Pressable
                style={styles.nextActionSecondary}
                onPress={() => {
                  if (!citySlug || checked.has(nextAction.id)) return;
                  const next = new Set(checked);
                  next.add(nextAction.id);
                  setChecked(next);
                  void AsyncStorage.setItem(
                    CHECKED_KEY(citySlug),
                    JSON.stringify(Array.from(next)),
                  );
                  track({
                    event: ANALYTICS_EVENTS.journeyStepCompleted,
                    citySlug,
                    entityType: 'RESOURCE',
                    entityId: nextAction.id,
                    metadata: {
                      source_surface: 'resources_journey',
                      action: 'mark_complete',
                    },
                  });
                  track({
                    event: ANALYTICS_EVENTS.journeyNextActionCompleted,
                    citySlug,
                    entityType: 'RESOURCE',
                    entityId: nextAction.id,
                    metadata: {
                      source_surface: 'resources_journey',
                    },
                  });
                  if (mobileFlags.resources.ctaEnabled) {
                    track({
                      event: ANALYTICS_EVENTS.resourceCtaClick,
                      citySlug,
                      entityType: 'RESOURCE',
                      entityId: nextAction.id,
                      metadata: {
                        cta_surface: 'resources_journey_next_action',
                        cta_position: 'secondary',
                        variant: 'action_first_v1',
                        action: 'mark_complete',
                      },
                    });
                  }
                }}
              >
                <Text style={styles.nextActionSecondaryText}>Mark complete</Text>
              </Pressable>
            </View>
          </View>
        )}

        {populated.map((s) => {
          const meta = STAGE_LABELS[s.stage];
          return (
            <View key={s.stage} style={styles.group}>
              <Text style={styles.groupTitle}>
                {meta.icon} {meta.title}
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
                    <Pressable
                      style={styles.cardBody}
                      onPress={() => {
                        if (citySlug && isStale(item.validUntil ?? null)) {
                          track({
                            event: ANALYTICS_EVENTS.resourcesStaleItemOpened,
                            citySlug,
                            entityType: 'RESOURCE',
                            entityId: item.id,
                            metadata: { resourceType: item.resourceType },
                          });
                        }
                        void open(item.url);
                      }}
                    >
                      <Text
                        style={[styles.cardTitle, isChecked && styles.cardTitleDone]}
                        numberOfLines={2}
                      >
                        {cat?.icon ? `${cat.icon}  ` : ''}
                        {item.title}
                      </Text>
                      <View style={styles.badgeRow}>
                        <Text style={styles.badgeNeutral}>{trustLabel(item.resourceType)}</Text>
                        <Text
                          style={
                            isStale(item.validUntil ?? null) ? styles.badgeStale : styles.badgeFresh
                          }
                        >
                          {isStale(item.validUntil ?? null) ? 'Needs review' : 'Fresh'}
                        </Text>
                      </View>
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
                  <Pressable
                    style={styles.cardBody}
                    onPress={() => {
                      if (citySlug && isStale(item.validUntil ?? null)) {
                        track({
                          event: ANALYTICS_EVENTS.resourcesStaleItemOpened,
                          citySlug,
                          entityType: 'RESOURCE',
                          entityId: item.id,
                          metadata: { resourceType: item.resourceType },
                        });
                      }
                      void open(item.url);
                    }}
                  >
                    <Text
                      style={[styles.cardTitle, isChecked && styles.cardTitleDone]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.badgeNeutral}>{trustLabel(item.resourceType)}</Text>
                      <Text
                        style={
                          isStale(item.validUntil ?? null) ? styles.badgeStale : styles.badgeFresh
                        }
                      >
                        {isStale(item.validUntil ?? null) ? 'Needs review' : 'Fresh'}
                      </Text>
                    </View>
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
  progressRow: {
    marginTop: spacing.xs ?? 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetButton: {
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  resetButtonText: { fontSize: typography.small, fontWeight: '700', color: palette.neutral.muted },
  nextActionCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.brand[200],
    backgroundColor: palette.brand[50],
    padding: spacing.md,
    gap: 4,
  },
  nextActionEyebrow: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.brand[700],
    letterSpacing: 0.5,
  },
  nextActionTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.neutral.foreground,
  },
  nextActionActions: { marginTop: 8, flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  nextActionPrimary: {
    borderRadius: radius.badge,
    backgroundColor: palette.brand[700],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  nextActionPrimaryText: { color: '#fff', fontSize: typography.small, fontWeight: '700' },
  nextActionSecondary: {
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: palette.brand[300],
    backgroundColor: palette.neutral.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  nextActionSecondaryText: {
    color: palette.brand[700],
    fontSize: typography.small,
    fontWeight: '700',
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
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 6 },
  badgeNeutral: {
    fontSize: 11,
    color: palette.neutral.muted,
    backgroundColor: palette.neutral.mutedBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  badgeFresh: {
    fontSize: 11,
    color: palette.status.success,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.badge,
    fontWeight: '700',
  },
  badgeStale: {
    fontSize: 11,
    color: palette.status.warning,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.badge,
    fontWeight: '700',
  },
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
