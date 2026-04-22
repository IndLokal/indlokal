import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

function parseTimeToMinutes(value: string): number | null {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export default function QuietHoursScreen() {
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('08:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);

    if (startMin === null || endMin === null) {
      setError('Use HH:mm format, e.g. 22:00 and 08:00');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = n.NotificationPreferencesUpdate.parse({
        quietHours: {
          startMin,
          endMin,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      await authClient.putAuthed<typeof payload, n.NotificationPreferences>(
        '/api/v1/notifications/preferences',
        payload,
      );

      router.back();
    } catch {
      setError('Failed to save quiet hours. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Quiet hours</Text>
        <Text style={styles.subtitle}>We will avoid non-urgent pushes in this window.</Text>

        <Text style={styles.label}>Start (HH:mm)</Text>
        <TextInput style={styles.input} value={start} onChangeText={setStart} placeholder="22:00" />

        <Text style={styles.label}>End (HH:mm)</Text>
        <TextInput style={styles.input} value={end} onChangeText={setEnd} placeholder="08:00" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={save} style={styles.button} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save quiet hours'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.neutral.background,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  subtitle: {
    color: palette.neutral.muted,
    marginBottom: spacing.sm,
  },
  label: {
    color: palette.neutral.foreground,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
    borderRadius: radius.button,
    backgroundColor: palette.brand[600],
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  error: {
    color: palette.status.destructive,
    fontWeight: '500',
  },
});
