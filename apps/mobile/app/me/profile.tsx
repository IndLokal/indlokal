import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PushPrePromptCard } from '@/components/PushPrePromptCard';
import { usePushPromptStore } from '@/lib/push-prompt-store';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function ProfileScreen() {
  const openForTrigger = usePushPromptStore((state) => state.openForTrigger);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.text}>
          Profile details will be shown here once /api/v1/me is wired.
        </Text>

        <Pressable
          style={styles.promptButton}
          onPress={() => {
            openForTrigger('follow_community');
          }}
        >
          <Text style={styles.promptButtonText}>Preview push prompt</Text>
        </Pressable>

        <PushPrePromptCard />
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
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  text: {
    color: palette.neutral.muted,
    fontSize: typography.body,
  },
  promptButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: palette.brand[600],
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promptButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
