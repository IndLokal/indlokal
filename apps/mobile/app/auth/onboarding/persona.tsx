import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '@/constants/theme';

const PERSONA_OPTIONS = ['New to this city', 'Student', 'Family', 'Working professional'];

export default function OnboardingPersonaScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>What best describes you?</Text>
        {PERSONA_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={styles.option}
            onPress={() => {
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        ))}
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
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
    marginBottom: spacing.sm,
  },
  option: {
    backgroundColor: palette.neutral.surface,
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionText: {
    fontSize: typography.body,
    color: palette.neutral.foreground,
    fontWeight: '600',
  },
});
