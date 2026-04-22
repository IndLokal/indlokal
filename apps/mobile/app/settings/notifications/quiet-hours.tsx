import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';

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

      await authClient.postAuthed<typeof payload, n.NotificationPreferences>(
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
    backgroundColor: '#f6f8fc',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginBottom: 8,
  },
  label: {
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#991b1b',
    fontWeight: '500',
  },
});
