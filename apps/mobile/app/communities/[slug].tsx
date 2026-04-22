/**
 * Mobile community detail — PRD-0006.
 * Renders the community with follow / share / channel actions + upcoming events.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { community as c, discovery as d } from '@indlokal/shared';
import { authClient, AuthClientError } from '@/lib/auth/client.expo';
import { invalidatePrefix, queryCache } from '@/lib/cache/query-cache';
import { palette, radius, spacing, typography } from '@/constants/theme';

const PUBLIC_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://indlokal.com';

type CommunityDetailWithFollowed = c.CommunityDetail & { followedByUser?: boolean };

function PulseBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.pulseRow}>
      <View style={styles.pulseLabelRow}>
        <Text style={styles.pulseLabel}>{label}</Text>
        <Text style={styles.pulseValue}>{pct}</Text>
      </View>
      <View style={styles.pulseTrack}>
        <View style={[styles.pulseFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const CHANNEL_LABEL: Record<c.ChannelType, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  EMAIL: 'Email',
  MEETUP: 'Meetup',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  OTHER: 'Other',
};

export default function CommunityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [data, setData] = useState<CommunityDetailWithFollowed | null>(null);
  const [events, setEvents] = useState<d.EventCard[]>([]);
  const [related, setRelated] = useState<c.CommunitySummary[]>([]);
  const [pulseExpanded, setPulseExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setError(null);
    try {
      const path = `/api/v1/communities/${encodeURIComponent(slug)}`;
      const tokens = await authClient.getTokens();
      const fetcher = tokens?.accessToken
        ? () => authClient.getAuthed<CommunityDetailWithFollowed>(path)
        : () => authClient.getPublic<CommunityDetailWithFollowed>(path);
      const detail = await queryCache(`community:${slug}`, fetcher, { ttl: 2 * 60 * 1000 });
      const parsed = c.CommunityDetail.parse(detail);
      setData({
        ...parsed,
        followedByUser: (detail as CommunityDetailWithFollowed).followedByUser,
      });

      const [eventsRes, relatedRes] = await Promise.all([
        queryCache(
          `community:${slug}:events`,
          () =>
            authClient.getPublic<d.EventsPage>(
              `/api/v1/communities/${encodeURIComponent(slug)}/events?limit=10`,
            ),
          { ttl: 2 * 60 * 1000 },
        ),
        queryCache(
          `community:${slug}:related`,
          () =>
            authClient.getPublic<c.CommunitySummary[]>(
              `/api/v1/communities/${encodeURIComponent(slug)}/related`,
            ),
          { ttl: 5 * 60 * 1000 },
        ),
      ]);
      setEvents(d.EventsPage.parse(eventsRes).items);
      setRelated(relatedRes.map((r) => c.CommunitySummary.parse(r)));
    } catch (err) {
      setError(err instanceof AuthClientError ? err.message : 'Could not load community.');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!data) return;
    const tokens = await authClient.getTokens();
    if (!tokens?.accessToken) {
      Alert.alert('Sign in needed', 'Sign in to follow communities.');
      return;
    }
    setBusy(true);
    const desired = !data.followedByUser;
    try {
      const path = `/api/v1/communities/${encodeURIComponent(data.slug)}/follow`;
      if (desired) {
        await authClient.postAuthed<Record<string, never>, c.FollowState>(path, {});
      } else {
        await authClient.deleteAuthed<c.FollowState>(path);
      }
      setData({ ...data, followedByUser: desired });
      invalidatePrefix('bookmarks:');
    } catch {
      Alert.alert('Could not update follow', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    if (!data) return;
    const url = `${PUBLIC_BASE_URL}/${data.city.slug}/communities/${data.slug}`;
    try {
      await Share.share({ message: `${data.name}\n${url}`, url });
    } catch {
      // user cancelled
    }
  }

  async function openChannel(channel: c.AccessChannel) {
    const ok = await Linking.canOpenURL(channel.url);
    if (ok) await Linking.openURL(channel.url);
    else Alert.alert("Couldn't open link", channel.url);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: data?.name ?? 'Community' }} />
      {!data && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand[600]} />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      {data && (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.meta}>
            {data.city.name}
            {data.categories.length > 0
              ? ` · ${data.categories.map((cat) => cat.category.name).join(', ')}`
              : ''}
          </Text>
          {data.memberCountApprox != null && (
            <Text style={styles.meta}>~{data.memberCountApprox.toLocaleString()} members</Text>
          )}

          <View style={styles.badgeRow}>
            {data.claimState === 'CLAIMED' && (
              <Text style={[styles.badge, styles.badgeClaimed]}>Claimed</Text>
            )}
            {data.isTrending && <Text style={[styles.badge, styles.badgeTrending]}>Trending</Text>}
            {data.status === 'ACTIVE' && (
              <Text style={[styles.badge, styles.badgeActive]}>Active</Text>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={toggleFollow}
              disabled={busy}
              style={[styles.actionPrimary, data.followedByUser && styles.actionFollowing]}
            >
              <Text style={styles.actionPrimaryText}>
                {data.followedByUser ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
            <Pressable onPress={onShare} style={styles.actionSecondary}>
              <Text style={styles.actionSecondaryText}>Share</Text>
            </Pressable>
          </View>

          <Link
            href={{ pathname: '/report/community/[id]', params: { id: data.id, name: data.name } }}
            style={styles.reportLink}
          >
            Report this community
          </Link>

          <Pressable onPress={() => setPulseExpanded((v) => !v)} style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <Text style={styles.sectionTitle}>Pulse Score</Text>
              <Text style={styles.pulseTotal}>
                {Math.round((data.activityScore + data.completenessScore + data.trustScore) / 3)}
                <Text style={styles.pulseTotalUnit}> / 100</Text>
              </Text>
            </View>
            <PulseBar label="Activity" value={data.activityScore} />
            <PulseBar label="Completeness" value={data.completenessScore} />
            <PulseBar label="Trust" value={data.trustScore} />
            {pulseExpanded && (
              <Text style={styles.pulseHelp}>
                Activity reflects recent posts and events. Completeness measures how filled-in the
                profile is. Trust combines verification, claim state, and user reports. Tap to
                collapse.
              </Text>
            )}
            {!pulseExpanded && <Text style={styles.pulseHelpToggle}>How is this calculated?</Text>}
          </Pressable>

          {data.descriptionLong || data.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.body}>{data.descriptionLong ?? data.description}</Text>
            </View>
          ) : null}

          {data.accessChannels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reach this community</Text>
              {data.accessChannels.map((channel) => (
                <Pressable
                  key={channel.id}
                  onPress={() => openChannel(channel)}
                  style={styles.channelRow}
                >
                  <Text style={styles.channelLabel}>
                    {CHANNEL_LABEL[channel.channelType]}
                    {channel.isPrimary ? ' · primary' : ''}
                  </Text>
                  <Text style={styles.channelUrl} numberOfLines={1}>
                    {channel.label ?? channel.url}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {events.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming events</Text>
              {events.slice(0, 5).map((ev) => (
                <Link
                  key={ev.id}
                  href={{ pathname: '/events/[slug]', params: { slug: ev.slug } }}
                  style={styles.eventRow}
                >
                  <View>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    <Text style={styles.eventMeta}>
                      {new Date(ev.startsAt).toLocaleString()}
                      {ev.venueName ? ` · ${ev.venueName}` : ''}
                    </Text>
                  </View>
                </Link>
              ))}
            </View>
          )}

          {related.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Related communities</Text>
              <FlatList
                data={related}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.relatedRail}
                renderItem={({ item }) => (
                  <Link
                    href={{ pathname: '/communities/[slug]', params: { slug: item.slug } }}
                    asChild
                  >
                    <Pressable style={styles.relatedCard}>
                      <Text style={styles.relatedName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.relatedMeta} numberOfLines={2}>
                        {item.description ?? item.city.name}
                      </Text>
                      <Text style={styles.relatedFooter}>
                        {item.upcomingEventCount > 0
                          ? `${item.upcomingEventCount} upcoming`
                          : item.city.name}
                      </Text>
                    </Pressable>
                  </Link>
                )}
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: typography.h1, fontWeight: '800', color: palette.neutral.foreground },
  meta: { fontSize: typography.body, color: palette.neutral.muted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  badgeClaimed: { backgroundColor: palette.brand[100], color: palette.brand[700] },
  badgeTrending: { backgroundColor: '#FEF3C7', color: '#92400E' },
  badgeActive: { backgroundColor: '#DCFCE7', color: '#166534' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionPrimary: {
    flex: 1,
    backgroundColor: palette.brand[600],
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  actionFollowing: { backgroundColor: palette.brand[700] },
  actionPrimaryText: { color: '#fff', fontWeight: '700' },
  actionSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    alignItems: 'center',
    backgroundColor: palette.neutral.surface,
  },
  actionSecondaryText: { color: palette.neutral.foreground, fontWeight: '600' },
  section: { gap: spacing.sm, marginTop: spacing.md },
  sectionTitle: { fontSize: typography.h4, fontWeight: '700', color: palette.neutral.foreground },
  body: { fontSize: typography.body, color: palette.neutral.foreground, lineHeight: 22 },
  channelRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.neutral.surface,
    borderWidth: 1,
    borderColor: palette.neutral.border,
  },
  channelLabel: { fontSize: typography.small, fontWeight: '700', color: palette.brand[600] },
  channelUrl: { fontSize: typography.body, color: palette.neutral.foreground, marginTop: 2 },
  eventRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  eventTitle: { fontSize: typography.body, color: palette.neutral.foreground, fontWeight: '600' },
  eventMeta: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 2 },
  reportLink: {
    marginTop: spacing.md,
    color: palette.status.destructive,
    fontWeight: '600',
    fontSize: typography.small,
  },
  pulseCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
    gap: spacing.sm,
  },
  pulseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pulseTotal: { fontSize: typography.h3, fontWeight: '800', color: palette.brand[600] },
  pulseTotalUnit: { fontSize: typography.small, color: palette.neutral.muted, fontWeight: '600' },
  pulseRow: { gap: 4 },
  pulseLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pulseLabel: { fontSize: typography.small, color: palette.neutral.foreground, fontWeight: '600' },
  pulseValue: { fontSize: typography.small, color: palette.neutral.muted, fontWeight: '600' },
  pulseTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.neutral.mutedBg,
    overflow: 'hidden',
  },
  pulseFill: { height: '100%', backgroundColor: palette.brand[600] },
  pulseHelp: { fontSize: typography.small, color: palette.neutral.muted, marginTop: spacing.xs },
  pulseHelpToggle: {
    fontSize: typography.small,
    color: palette.brand[600],
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  relatedRail: { gap: spacing.sm, paddingRight: spacing.lg },
  relatedCard: {
    width: 220,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
    marginRight: spacing.sm,
    gap: 4,
  },
  relatedName: { fontSize: typography.body, fontWeight: '700', color: palette.brand[700] },
  relatedMeta: { fontSize: typography.small, color: palette.neutral.muted },
  relatedFooter: { fontSize: 12, color: palette.brand[600], fontWeight: '600', marginTop: 4 },
  error: { color: palette.status.destructive },
});
