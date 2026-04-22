/**
 * Report community content — PRD-0010.
 * Renders a small report sheet for a community by id (passed via params).
 * POST /api/v1/reports.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { resources as r } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { palette, radius, spacing, typography } from '@/constants/theme';

const REPORT_TYPES: Array<{ value: r.ReportType; label: string; help: string }> = [
  { value: 'STALE_INFO', label: 'Out of date', help: 'Hours, location, or details look stale.' },
  { value: 'BROKEN_LINK', label: 'Broken link', help: 'A channel link no longer works.' },
  {
    value: 'INCORRECT_DETAILS',
    label: 'Incorrect details',
    help: 'The community description is wrong.',
  },
  { value: 'OTHER', label: 'Other', help: 'Something else.' },
];

export default function ReportCommunityScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [reportType, setReportType] = useState<r.ReportType>('STALE_INFO');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!id) return;
    setBusy(true);
    try {
      const payload: r.ContentReportInput = {
        reportType,
        communityId: id,
        details: details.trim() || undefined,
        reporterEmail: reporterEmail.trim() || undefined,
      };
      const validated = r.ContentReportInput.parse(payload);
      await authClient.postAuthed<r.ContentReportInput, r.ContentReport>(
        '/api/v1/reports',
        validated as unknown as r.ContentReportInput & Record<string, unknown>,
      );
      Alert.alert('Thanks for the report', "We'll review it shortly.", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Could not send report',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Report' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Report this community</Text>
          {name && <Text style={styles.sub}>{name}</Text>}

          {REPORT_TYPES.map((opt) => {
            const active = opt.value === reportType;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setReportType(opt.value)}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={[styles.radio, active && styles.radioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionHelp}>{opt.help}</Text>
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.label}>Details (optional)</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="What did you notice?"
            style={[styles.input, styles.textarea]}
            placeholderTextColor={palette.neutral.muted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Your email (optional)</Text>
          <TextInput
            value={reporterEmail}
            onChangeText={setReporterEmail}
            placeholder="So we can follow up"
            style={styles.input}
            placeholderTextColor={palette.neutral.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Pressable
            onPress={onSubmit}
            disabled={busy || !id}
            style={[styles.primary, (busy || !id) && styles.primaryDisabled]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Send report</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.neutral.background },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  title: { fontSize: typography.h3, fontWeight: '800', color: palette.neutral.foreground },
  sub: { fontSize: typography.body, color: palette.neutral.muted, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    backgroundColor: palette.neutral.surface,
  },
  optionActive: { borderColor: palette.brand[600], backgroundColor: palette.brand[50] },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.neutral.border,
  },
  radioActive: { borderColor: palette.brand[600], backgroundColor: palette.brand[600] },
  optionLabel: { fontSize: typography.body, fontWeight: '700', color: palette.neutral.foreground },
  optionHelp: { fontSize: typography.small, color: palette.neutral.muted, marginTop: 2 },
  label: {
    fontSize: typography.small,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  primary: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    backgroundColor: palette.brand[600],
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
