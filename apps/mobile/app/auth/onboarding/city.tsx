import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function OnboardingCityScreen() {
  const [city, setCity] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Which city are you in?</Text>
        <TextInput
          placeholder="e.g. Stuttgart"
          placeholderTextColor={palette.neutral.muted}
          value={city}
          onChangeText={setCity}
          style={styles.input}
        />
        <Pressable
          disabled={!city.trim()}
          style={[styles.button, !city.trim() && styles.disabled]}
          onPress={() => router.push('/auth/onboarding/persona')}
        >
          <Text style={styles.buttonText}>Continue</Text>
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
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.neutral.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: palette.neutral.surface,
    color: palette.neutral.foreground,
    fontSize: typography.body,
  },
  button: {
    backgroundColor: palette.brand[600],
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
  disabled: {
    opacity: 0.5,
  },
});
