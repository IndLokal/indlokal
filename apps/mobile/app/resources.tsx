/**
 * Mobile resources screen — PRD-0010.
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
import { Stack } from 'expo-router';
import { resources as r } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const SELECTED_CITY_KEY = 'indlokal.discover.selectedCitySlug.v1';

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

export default function ResourcesScreen() {
  const [citySlug, setCitySlug] = useState<string | null>(null);
  const [items, setItems] = useState<r.Resource[]>([]);
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

  const grouped = useMemo(() => {
    const map = new Map<r.ResourceType, r.Resource[]>();
    for (const item of items) {
      const list = map.get(item.resourceType) ?? [];
      list.push(item);
      map.set(item.resourceType, list);
    }
    return Array.from(map.entries());
  }, [items]);

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

        {grouped.map(([type, list]) => (
          <View key={type} style={styles.group}>
            <Text style={styles.groupTitle}>{TYPE_LABEL[type] ?? type}</Text>
            {list.map((item) => (
              <Pressable key={item.id} onPress={() => open(item.url)} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
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
          </View>
        ))}
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
  card: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  cardTitle: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  cardMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 4 },
  cardLink: {
    fontSize: typography.small,
    color: palette.brand[600],
    marginTop: 6,
    fontWeight: '600',
  },
});
