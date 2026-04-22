import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

type InboxState = {
  items: n.InboxItem[];
  nextCursor?: string;
};

export default function InboxScreen() {
  const [inbox, setInbox] = useState<InboxState>({ items: [] });
  const [loading, setLoading] = useState(false);

  async function load(cursor?: string) {
    setLoading(true);
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
      const response = await authClient.getAuthed<n.InboxPage>(
        `/api/v1/notifications/inbox${query}`,
      );
      const parsed = n.InboxPage.parse(response);

      setInbox((current) => ({
        items: cursor ? [...current.items, ...parsed.items] : parsed.items,
        nextCursor: parsed.nextCursor,
      }));
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    if (inbox.items.length === 0) return;

    const unreadIds = inbox.items.filter((item) => item.readAt === null).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const payload = n.InboxReadRequest.parse({ ids: unreadIds });
    await authClient.postAuthed<typeof payload, n.InboxReadResponse>(
      '/api/v1/notifications/inbox/read',
      payload,
    );

    setInbox((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() },
      ),
    }));
  }

  useEffect(() => {
    load().catch(() => {
      setInbox({ items: [] });
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Inbox</Text>
          <Pressable onPress={markAllRead} style={styles.markReadButton}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </Pressable>
        </View>

        {inbox.items.length === 0 ? (
          <Text style={styles.empty}>No notifications yet.</Text>
        ) : (
          inbox.items.map((item) => (
            <View
              key={item.id}
              style={[styles.card, item.readAt ? styles.readCard : styles.unreadCard]}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardMeta}>{item.topic.replaceAll('_', ' ')}</Text>
            </View>
          ))
        )}

        {inbox.nextCursor ? (
          <Pressable
            style={styles.loadMoreButton}
            onPress={() => {
              load(inbox.nextCursor).catch(() => undefined);
            }}
            disabled={loading}
          >
            <Text style={styles.loadMoreText}>{loading ? 'Loading...' : 'Load more'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.neutral.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  markReadButton: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: palette.neutral.surface,
  },
  markReadText: {
    color: palette.brand[700],
    fontWeight: '700',
    fontSize: typography.small - 2,
  },
  empty: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    marginTop: spacing.md,
  },
  card: {
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
  },
  unreadCard: {
    backgroundColor: palette.neutral.surface,
    borderColor: palette.brand[200],
  },
  readCard: {
    backgroundColor: palette.neutral.mutedBg,
    borderColor: palette.neutral.border,
  },
  cardTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  cardBody: {
    marginTop: spacing.xs,
    color: palette.neutral.muted,
    lineHeight: 20,
  },
  cardMeta: {
    marginTop: spacing.sm,
    textTransform: 'capitalize',
    fontSize: typography.small - 2,
    color: palette.neutral.muted,
    fontWeight: '600',
  },
  loadMoreButton: {
    marginTop: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: palette.brand[600],
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
});
