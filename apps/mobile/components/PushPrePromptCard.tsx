import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePushPermission } from '@/lib/notifications';
import { usePushPromptStore } from '@/lib/push-prompt-store';

const TRIGGER_LABELS: Record<string, string> = {
  save_event: 'saved events',
  follow_community: 'community updates',
  rsvp: 'RSVP reminders',
};

export function PushPrePromptCard() {
  const [loading, setLoading] = useState(false);
  const { requestPermission } = usePushPermission();
  const activeTrigger = usePushPromptStore((state) => state.activeTrigger);
  const accept = usePushPromptStore((state) => state.accept);
  const decline = usePushPromptStore((state) => state.decline);

  if (!activeTrigger) return null;

  const label = TRIGGER_LABELS[activeTrigger] ?? 'updates';

  async function onEnable() {
    setLoading(true);
    try {
      await requestPermission();
      accept();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Turn on push notifications</Text>
      <Text style={styles.body}>Get timely alerts for {label}.</Text>

      <Pressable style={styles.primaryButton} onPress={onEnable} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Enable push</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={decline} disabled={loading}>
        <Text style={styles.secondaryButtonText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3f1',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    fontSize: 15,
    color: '#475569',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d7e2',
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1e293b',
    fontWeight: '600',
  },
});
