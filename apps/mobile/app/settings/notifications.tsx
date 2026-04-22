import { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';

type PreferencesState = n.NotificationPreferences | null;

export default function NotificationsSettingsScreen() {
  const [prefs, setPrefs] = useState<PreferencesState>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authClient
      .getAuthed<n.NotificationPreferences>('/api/v1/notifications/preferences')
      .then((response) => {
        setPrefs(n.NotificationPreferences.parse(response));
      })
      .catch(() => {
        setPrefs({
          preferences: [],
          quietHours: { startMin: 1320, endMin: 480, timezone: 'Europe/Berlin' },
        });
      });
  }, []);

  const grouped = useMemo(() => {
    if (!prefs)
      return [] as Array<{ topic: n.NotificationTopic; rows: n.NotificationPreferenceItem[] }>;

    return n.NotificationTopic.options.map((topic) => ({
      topic,
      rows: prefs.preferences.filter((item) => item.topic === topic),
    }));
  }, [prefs]);

  function toggle(topic: n.NotificationTopic, channel: n.NotificationChannel) {
    setPrefs((current) => {
      if (!current) return current;

      const nextPreferences = current.preferences.map((item) =>
        item.topic === topic && item.channel === channel
          ? { ...item, enabled: !item.enabled }
          : item,
      );

      return { ...current, preferences: nextPreferences };
    });
  }

  async function save() {
    if (!prefs) return;

    setSaving(true);
    try {
      const payload = n.NotificationPreferencesUpdate.parse({ preferences: prefs.preferences });
      const response = await authClient.postAuthed<typeof payload, n.NotificationPreferences>(
        '/api/v1/notifications/preferences',
        payload,
      );
      setPrefs(n.NotificationPreferences.parse(response));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Choose where each update type should reach you.</Text>

        {grouped.map((group) => (
          <View key={group.topic} style={styles.topicCard}>
            <Text style={styles.topicTitle}>{group.topic.replaceAll('_', ' ')}</Text>
            {group.rows.map((item) => (
              <Pressable
                key={`${item.topic}:${item.channel}`}
                onPress={() => toggle(item.topic, item.channel)}
                style={styles.row}
              >
                <Text style={styles.rowLabel}>{item.channel}</Text>
                <Text style={item.enabled ? styles.enabled : styles.disabled}>
                  {item.enabled ? 'On' : 'Off'}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Link href="/settings/notifications/quiet-hours" style={styles.link}>
          Edit quiet hours
        </Link>

        <Pressable style={styles.saveButton} onPress={save} disabled={saving || !prefs}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save preferences'}</Text>
        </Pressable>
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
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
  },
  topicCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderColor: '#dbe3f1',
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'capitalize',
  },
  row: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2fb',
  },
  rowLabel: {
    color: '#1e293b',
    fontWeight: '500',
  },
  enabled: {
    color: '#166534',
    fontWeight: '600',
  },
  disabled: {
    color: '#991b1b',
    fontWeight: '600',
  },
  link: {
    color: '#0f172a',
    fontWeight: '600',
    marginTop: 4,
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
