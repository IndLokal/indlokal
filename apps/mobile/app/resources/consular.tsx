/**
 * Consular & official services screen - PRD/TDD-0040.
 *
 * Parity with the web /consular-services surface. Reuses the city resources
 * feed and filters/groups it to the official resource types via the pure
 * `lib/resources/consular` module - no new endpoint needed.
 */

import { useCallback, useEffect, useState } from 'react';
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
import { resources as r } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { groupConsularResources, type ConsularSection } from '@/lib/resources/consular';
import { track } from '@/lib/analytics/track.expo';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

export default function ConsularServicesScreen() {
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [sections, setSections] = useState<ConsularSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_CITY_KEY).then((value) => setCitySlug(value ?? 'stuttgart'));
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
      const parsed = res.map((row) => r.Resource.parse(row));
      setSections(groupConsularResources(parsed));
      track({ event: ANALYTICS_EVENTS.consularViewed, citySlug: slug });
    } catch {
      setError('Could not load consular services right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (citySlug) void load(citySlug);
  }, [citySlug, load]);

  async function open(url: string | null) {
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert("Couldn't open link", url);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Consular services' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Consular & official services</Text>
        <Text style={styles.sub}>
          Indian missions, visa & passport help, and official information for your city.
        </Text>

        {loading && <ActivityIndicator color={palette.brand[600]} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && sections.length === 0 && (
          <Text style={styles.empty}>No official services listed for this city yet.</Text>
        )}

        {sections.map((section) => (
          <View key={section.type} style={styles.group}>
            <Text style={styles.groupTitle}>{section.label}</Text>
            {section.resources.map((item) => (
              <Pressable key={item.id} onPress={() => open(item.url)} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                {item.url && <Text style={styles.cardLink}>Open link</Text>}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: typography.h2, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted },
  loading: { marginVertical: spacing.lg },
  error: { color: palette.status.destructive },
  empty: { color: palette.neutral.muted, marginTop: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.md },
  groupTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.brand[700] },
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted },
  cardLink: { fontSize: typography.small, color: palette.brand[600], fontWeight: '600' },
});
