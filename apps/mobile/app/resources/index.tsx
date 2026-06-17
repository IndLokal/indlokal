/**
 * Mobile resources screen - PRD-0010.
 * Lists city resources grouped by ResourceType, opens the official link.
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
import { Link, Stack, useRouter } from 'expo-router';
import { resources as r, resourceCategories as rc } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { mobileFlags } from '@/lib/config/flags';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';
const JOURNEY_CHECKED_KEY = (citySlug: string) => `resource_journey:v1:${citySlug}`;

const TYPE_LABEL: Record<r.ResourceType, string> = {
  CONSULAR_SERVICE: 'Consular',
  OFFICIAL_EVENT: 'Official events',
  GOVERNMENT_INFO: 'Government info',
  VISA_SERVICE: 'Visa',
  CITY_REGISTRATION: 'City registration',
  DRIVING: 'Driving',
  HOUSING: 'Housing',
  HEALTH_DOCTORS: 'Health & doctors',
  FAMILY_CHILDREN: 'Family & children',
  JOBS_CAREERS: 'Jobs & careers',
  TAX_FINANCE: 'Tax & finance',
  BUSINESS_SETUP: 'Business setup',
  GROCERY_FOOD: 'Grocery & food',
  COMMUNITY_RESOURCE: 'Community',
};

const PERSONA_PRESETS = {
  student: { label: 'Student', audiences: ['STUDENT', 'STUDENT_VISA'] as const },
  family: { label: 'Family', audiences: ['FAMILY'] as const },
  employee: { label: 'Employee', audiences: ['EMPLOYEE'] as const },
  founder: { label: 'Founder', audiences: ['FOUNDER'] as const },
  newcomer: { label: 'Newcomer', audiences: ['NEWCOMER'] as const },
} as const;

const INTENT_PRESETS = {
  anmeldung: { label: 'Anmeldung', types: ['CITY_REGISTRATION'] as const },
  housing: { label: 'Housing', types: ['HOUSING'] as const },
  health: { label: 'Health', types: ['HEALTH_DOCTORS'] as const },
  visa: { label: 'Visa', types: ['VISA_SERVICE', 'CONSULAR_SERVICE'] as const },
  tax: { label: 'Tax', types: ['TAX_FINANCE'] as const },
  jobs: { label: 'Jobs', types: ['JOBS_CAREERS'] as const },
} as const;

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

export default function ResourcesScreen() {
  const router = useRouter();
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [items, setItems] = useState<r.Resource[]>([]);
  const [persona, setPersona] = useState<keyof typeof PERSONA_PRESETS | null>(null);
  const [intent, setIntent] = useState<keyof typeof INTENT_PRESETS | null>(null);
  const [showPersonaRefine, setShowPersonaRefine] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [journeyChecked, setJourneyChecked] = useState<Set<string>>(new Set());
  const [journeyHydrated, setJourneyHydrated] = useState(false);
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
        `resources:${slug}`,
        () =>
          authClient.getPublic<r.Resource[]>(
            `/api/v1/cities/${encodeURIComponent(slug)}/resources`,
          ),
        { ttl: 10 * 60 * 1000 },
      );
      setItems(res.map((row) => r.Resource.parse(row)));
    } catch {
      setError('Could not load resources right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (citySlug) void load(citySlug);
  }, [citySlug, load]);

  useEffect(() => {
    if (!citySlug) return;
    AsyncStorage.getItem(JOURNEY_CHECKED_KEY(citySlug))
      .then((raw) => {
        if (!raw) {
          setJourneyChecked(new Set());
          return;
        }
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) {
            setJourneyChecked(new Set());
            return;
          }
          const ids = parsed.filter((value): value is string => typeof value === 'string');
          setJourneyChecked(new Set(ids));
        } catch {
          setJourneyChecked(new Set());
        }
      })
      .finally(() => setJourneyHydrated(true));
  }, [citySlug]);

  const grouped = useMemo(() => {
    const filtered = items.filter((item) => {
      const personaOk =
        !persona || PERSONA_PRESETS[persona].audiences.some((aud) => item.audiences?.includes(aud));
      const intentOk = !intent || INTENT_PRESETS[intent].types.includes(item.resourceType as never);
      return personaOk && intentOk;
    });

    const map = new Map<r.ResourceType, r.Resource[]>();
    for (const item of filtered) {
      const list = map.get(item.resourceType) ?? [];
      list.push(item);
      map.set(item.resourceType, list);
    }
    return Array.from(map.entries());
  }, [items, persona, intent]);

  const essentials = useMemo(() => {
    const filtered = items.filter((it) => {
      const personaOk =
        !persona || PERSONA_PRESETS[persona].audiences.some((aud) => it.audiences?.includes(aud));
      const intentOk = !intent || INTENT_PRESETS[intent].types.includes(it.resourceType as never);
      return personaOk && intentOk;
    });

    const source = filtered.length > 0 ? filtered : items;
    return source
      .filter((it) => it.isEssential)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, 4);
  }, [items, persona, intent]);

  const nextJourneyAction = useMemo(() => {
    for (const item of essentials) {
      if (!journeyChecked.has(item.id)) return item;
    }
    return null;
  }, [essentials, journeyChecked]);

  const hasJourneyResume =
    journeyChecked.size > 0 &&
    nextJourneyAction !== null &&
    journeyChecked.size < essentials.length;

  useEffect(() => {
    if (!citySlug) return;
    track({
      event: ANALYTICS_EVENTS.resourcesHubView,
      citySlug,
      metadata: { persona, intent, variant: 'control' },
    });
    track({
      event: ANALYTICS_EVENTS.resourcesExperimentVariantAssigned,
      citySlug,
      metadata: { variant: 'control', module: 'resources_hub' },
    });
    track({
      event: ANALYTICS_EVENTS.resourcesTrustBadgeImpression,
      citySlug,
      metadata: { surface: 'resources_hub' },
    });
    if (mobileFlags.resources.ctaEnabled) {
      track({
        event: ANALYTICS_EVENTS.resourceCtaVariantAssigned,
        citySlug,
        metadata: { variant: 'action_first_v1', module: 'resources_hub' },
      });
      track({
        event: ANALYTICS_EVENTS.resourceCtaImpression,
        citySlug,
        metadata: {
          cta_surface: 'resources_hub',
          cta_position: 'primary',
          variant: 'action_first_v1',
        },
      });
    }
  }, [citySlug, persona, intent]);

  useEffect(() => {
    if (
      !citySlug ||
      !mobileFlags.resources.resumeEnabled ||
      !journeyHydrated ||
      !hasJourneyResume ||
      !nextJourneyAction
    )
      return;

    track({
      event: ANALYTICS_EVENTS.journeyResumePromptShown,
      citySlug,
      metadata: {
        source_surface: 'resources_hub_resume',
        progress_completed: journeyChecked.size,
        progress_total: essentials.length,
        next_action_id: nextJourneyAction.id,
      },
    });
    track({
      event: ANALYTICS_EVENTS.journeyNextActionImpression,
      citySlug,
      metadata: {
        source_surface: 'resources_hub_resume',
        next_action_id: nextJourneyAction.id,
      },
    });
  }, [
    citySlug,
    journeyHydrated,
    hasJourneyResume,
    nextJourneyAction,
    journeyChecked.size,
    essentials.length,
  ]);

  async function open(url: string | null) {
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert("Couldn't open link", url);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Resources' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Resources</Text>
        <Text style={styles.sub}>Official services and practical guides for your city.</Text>

        {loading && <ActivityIndicator color={palette.brand[600]} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && items.length === 0 && (
          <Text style={styles.empty}>No resources for this city yet.</Text>
        )}

        {mobileFlags.resources.resumeEnabled &&
          journeyHydrated &&
          hasJourneyResume &&
          nextJourneyAction && (
            <View style={styles.resumeCard}>
              <Text style={styles.resumeEyebrow}>RESUME JOURNEY</Text>
              <Text style={styles.resumeTitle}>Pick up where you left off</Text>
              <Text style={styles.resumeMeta}>Next best action: {nextJourneyAction.title}</Text>
              <View style={styles.resumeActions}>
                <Pressable
                  style={styles.resumePrimaryButton}
                  onPress={() => {
                    if (!citySlug) return;
                    track({
                      event: ANALYTICS_EVENTS.journeyResumeClicked,
                      citySlug,
                      metadata: {
                        source_surface: 'resources_hub_resume',
                        next_action_id: nextJourneyAction.id,
                      },
                    });
                    track({
                      event: ANALYTICS_EVENTS.journeyNextActionClick,
                      citySlug,
                      metadata: {
                        source_surface: 'resources_hub_resume',
                        next_action_id: nextJourneyAction.id,
                      },
                    });
                    track({
                      event: ANALYTICS_EVENTS.resourceCtaClick,
                      citySlug,
                      metadata: {
                        cta_surface: 'resources_hub_resume',
                        cta_position: 'primary',
                        variant: 'action_first_v1',
                        next_action_id: nextJourneyAction.id,
                      },
                    });
                    router.push('/resources/journey' as never);
                  }}
                >
                  <Text style={styles.resumePrimaryButtonText}>Continue next step</Text>
                </Pressable>

                <Pressable
                  style={styles.resumeSecondaryButton}
                  onPress={() => {
                    if (!citySlug) return;
                    const next = new Set<string>();
                    setJourneyChecked(next);
                    void AsyncStorage.setItem(
                      JOURNEY_CHECKED_KEY(citySlug),
                      JSON.stringify(Array.from(next)),
                    );
                    track({
                      event: ANALYTICS_EVENTS.journeyProgressReset,
                      citySlug,
                      metadata: { source_surface: 'resources_hub_resume' },
                    });
                    track({
                      event: ANALYTICS_EVENTS.resourceCtaClick,
                      citySlug,
                      metadata: {
                        cta_surface: 'resources_hub_resume',
                        cta_position: 'secondary',
                        variant: 'action_first_v1',
                        action: 'reset_progress',
                      },
                    });
                  }}
                >
                  <Text style={styles.resumeSecondaryButtonText}>Reset progress</Text>
                </Pressable>
              </View>
            </View>
          )}

        {mobileFlags.resources.personaEnabled && !mobileFlags.resources.intentEnabled && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Choose your profile</Text>
            <View style={styles.chipsWrap}>
              {Object.entries(PERSONA_PRESETS).map(([slug, cfg]) => {
                const active = persona === slug;
                return (
                  <Pressable
                    key={slug}
                    onPress={() => {
                      const next = active ? null : (slug as keyof typeof PERSONA_PRESETS);
                      setPersona(next);
                      if (citySlug) {
                        track({
                          event: ANALYTICS_EVENTS.resourcesPersonaSelected,
                          citySlug,
                          metadata: { persona: next },
                        });
                      }
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {mobileFlags.resources.intentEnabled && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>I need help with...</Text>
            <View style={styles.chipsWrap}>
              {Object.entries(INTENT_PRESETS).map(([slug, cfg]) => {
                const active = intent === slug;
                return (
                  <Pressable
                    key={slug}
                    onPress={() => {
                      const next = active ? null : (slug as keyof typeof INTENT_PRESETS);
                      setIntent(next);
                      if (citySlug) {
                        track({
                          event: ANALYTICS_EVENTS.resourcesIntentChipSelected,
                          citySlug,
                          metadata: { intent: next },
                        });
                      }
                    }}
                    style={[styles.chip, active && styles.chipActiveSoft]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextSoft]}>
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mobileFlags.resources.personaEnabled && (
              <View style={styles.refineCard}>
                <Pressable
                  style={styles.refineToggle}
                  onPress={() => setShowPersonaRefine((current) => !current)}
                >
                  <Text style={styles.refineToggleText}>
                    {showPersonaRefine ? 'Hide profile refine' : 'Refine by profile'}
                  </Text>
                </Pressable>

                {showPersonaRefine && (
                  <View style={styles.chipsWrap}>
                    {Object.entries(PERSONA_PRESETS).map(([slug, cfg]) => {
                      const active = persona === slug;
                      return (
                        <Pressable
                          key={slug}
                          onPress={() => {
                            const next = active ? null : (slug as keyof typeof PERSONA_PRESETS);
                            setPersona(next);
                            if (citySlug) {
                              track({
                                event: ANALYTICS_EVENTS.resourcesPersonaSelected,
                                citySlug,
                                metadata: { persona: next },
                              });
                            }
                          }}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {cfg.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {essentials.length > 0 && (
          <Link href={'/resources/journey' as never} asChild>
            <Pressable
              style={styles.journeyCard}
              onPress={() => {
                if (citySlug) {
                  track({
                    event: ANALYTICS_EVENTS.resourcesEssentialsClick,
                    citySlug,
                    metadata: { source: 'journey_card' },
                  });
                  if (mobileFlags.resources.ctaEnabled) {
                    track({
                      event: ANALYTICS_EVENTS.resourceCtaClick,
                      citySlug,
                      metadata: {
                        cta_surface: 'resources_journey_card',
                        cta_position: 'primary',
                        variant: 'action_first_v1',
                      },
                    });
                  }
                  track({
                    event: ANALYTICS_EVENTS.resourcesFirstMeaningfulAction,
                    citySlug,
                    metadata: { source_event: ANALYTICS_EVENTS.resourcesEssentialsClick },
                  });
                }
              }}
            >
              <Text style={styles.journeyEyebrow}>NEWCOMER JOURNEY</Text>
              <Text style={styles.journeyTitle}>Your first-30-day checklist</Text>
              <Text style={styles.journeyMeta}>
                {essentials.length} essential {essentials.length === 1 ? 'step' : 'steps'} for new
                arrivals
              </Text>
              <Text style={styles.journeyCta}>Open checklist →</Text>
            </Pressable>
          </Link>
        )}

        <Link href={'/resources/consular' as never} asChild>
          <Pressable style={styles.consularCard}>
            <Text style={styles.consularEyebrow}>OFFICIAL & CONSULAR</Text>
            <Text style={styles.consularTitle}>Consular & official services</Text>
            <Text style={styles.consularMeta}>
              Indian missions, visa & passport help, government info
            </Text>
            <Text style={styles.consularCta}>View services →</Text>
          </Pressable>
        </Link>

        {(showAllTopics ? grouped : grouped.slice(0, 3)).map(([type, list]) => {
          const cat = rc.RESOURCE_CATEGORIES.find((c) => c.type === type);
          const label = cat?.title ?? TYPE_LABEL[type] ?? type;
          const icon = cat?.icon;
          const visibleList = showAllTopics ? list : list.slice(0, 2);
          return (
            <View key={type} style={styles.group}>
              <Text style={styles.groupTitle}>
                {icon ? `${icon}  ` : ''}
                {label}
              </Text>
              {visibleList.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    const stale = isStale(item.validUntil ?? null);
                    if (citySlug) {
                      track({
                        event: ANALYTICS_EVENTS.resourcesFirstMeaningfulAction,
                        citySlug,
                        entityType: 'RESOURCE',
                        entityId: item.id,
                        metadata: {
                          resourceType: item.resourceType,
                          intent,
                          persona,
                        },
                      });
                      if (stale) {
                        track({
                          event: ANALYTICS_EVENTS.resourcesStaleItemOpened,
                          citySlug,
                          entityType: 'RESOURCE',
                          entityId: item.id,
                          metadata: { resourceType: item.resourceType },
                        });
                      }
                    }
                    void open(item.url);
                  }}
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
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
                  {item.url && (
                    <Text style={styles.cardLink} numberOfLines={1}>
                      Open link
                    </Text>
                  )}
                </Pressable>
              ))}
              {!showAllTopics && list.length > visibleList.length && (
                <Text style={styles.moreHintText}>
                  +{list.length - visibleList.length} more in this topic
                </Text>
              )}
            </View>
          );
        })}

        {grouped.length > 3 && (
          <Pressable
            style={styles.expandTopicsButton}
            onPress={() => setShowAllTopics((current) => !current)}
          >
            <Text style={styles.expandTopicsButtonText}>
              {showAllTopics ? 'Show fewer topics' : 'Explore all topics'}
            </Text>
          </Pressable>
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
  loading: { marginVertical: spacing.lg },
  error: { color: palette.status.destructive },
  empty: { color: palette.neutral.muted, marginTop: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.md },
  groupTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.brand[700] },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: palette.brand[600],
    borderColor: palette.brand[600],
  },
  chipActiveSoft: {
    backgroundColor: palette.brand[50],
    borderColor: palette.brand[300],
  },
  chipText: { fontSize: typography.small, color: palette.neutral.foreground, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipTextSoft: { color: palette.brand[700] },
  refineCard: {
    marginTop: spacing.sm,
    backgroundColor: palette.neutral.surface,
    borderColor: palette.neutral.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  refineToggle: {
    alignSelf: 'flex-start',
    borderRadius: radius.badge,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.mutedBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  refineToggleText: {
    fontSize: typography.small,
    color: palette.neutral.foreground,
    fontWeight: '700',
  },
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
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
  cardLink: {
    fontSize: typography.small,
    color: palette.brand[600],
    marginTop: 6,
    fontWeight: '600',
  },
  moreHintText: {
    fontSize: typography.small,
    color: palette.neutral.muted,
    marginTop: 2,
  },
  expandTopicsButton: {
    marginTop: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.brand[200],
    backgroundColor: palette.brand[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  expandTopicsButtonText: {
    color: palette.brand[700],
    fontSize: typography.body,
    fontWeight: '700',
  },
  journeyCard: {
    backgroundColor: palette.brand[50],
    borderColor: palette.brand[200],
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  resumeCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  resumeEyebrow: {
    fontSize: typography.small,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.5,
  },
  resumeTitle: {
    fontSize: typography.h4,
    fontWeight: '800',
    color: palette.neutral.foreground,
    marginTop: 2,
  },
  resumeMeta: { fontSize: typography.small, color: '#166534' },
  resumeActions: { flexDirection: 'row', gap: spacing.xs, marginTop: 8, flexWrap: 'wrap' },
  resumePrimaryButton: {
    backgroundColor: '#166534',
    borderRadius: radius.badge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  resumePrimaryButtonText: { color: '#fff', fontSize: typography.small, fontWeight: '700' },
  resumeSecondaryButton: {
    backgroundColor: '#fff',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  resumeSecondaryButtonText: { color: '#166534', fontSize: typography.small, fontWeight: '700' },
  journeyEyebrow: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.brand[700],
    letterSpacing: 0.5,
  },
  journeyTitle: {
    fontSize: typography.h4,
    fontWeight: '800',
    color: palette.neutral.foreground,
    marginTop: 2,
  },
  journeyMeta: { fontSize: typography.small, color: palette.neutral.muted },
  journeyCta: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.brand[700],
    marginTop: 6,
  },
  consularCard: {
    backgroundColor: palette.accent[50],
    borderColor: palette.accent[200],
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  consularEyebrow: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.accent[700],
    letterSpacing: 0.5,
  },
  consularTitle: {
    fontSize: typography.h4,
    fontWeight: '800',
    color: palette.neutral.foreground,
    marginTop: 2,
  },
  consularMeta: { fontSize: typography.small, color: palette.neutral.muted },
  consularCta: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.accent[700],
    marginTop: 6,
  },
});
