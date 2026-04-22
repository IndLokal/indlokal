import { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

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
      const response = await authClient.putAuthed<typeof payload, n.NotificationPreferences>(
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
    backgroundColor: palette.neutral.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  subtitle: {
    fontSize: typography.body,
    color: palette.neutral.muted,
  },
  topicCard: {
    backgroundColor: palette.neutral.surface,
    borderRadius: radius.card,
    borderColor: palette.neutral.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topicTitle: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.neutral.foreground,
    textTransform: 'capitalize',
  },
  row: {
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.neutral.border,
  },
  rowLabel: {
    color: palette.neutral.foreground,
    fontWeight: '500',
  },
  enabled: {
    color: palette.status.success,
    fontWeight: '700',
  },
  disabled: {
    color: palette.status.destructive,
    fontWeight: '700',
  },
  link: {
    color: palette.brand[600],
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  saveButton: {
    marginTop: spacing.xs,
    borderRadius: radius.button,
    backgroundColor: palette.brand[600],
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
});
