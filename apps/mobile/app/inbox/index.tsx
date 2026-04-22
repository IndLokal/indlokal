import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';

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
    backgroundColor: '#f6f8fc',
  },
  container: {
    padding: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  markReadButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  markReadText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  empty: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  unreadCard: {
    backgroundColor: '#fff',
    borderColor: '#dbe3f1',
  },
  readCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardBody: {
    marginTop: 4,
    color: '#334155',
    lineHeight: 20,
  },
  cardMeta: {
    marginTop: 8,
    textTransform: 'capitalize',
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  loadMoreButton: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 11,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#fff',
    fontWeight: '600',
  },
});
