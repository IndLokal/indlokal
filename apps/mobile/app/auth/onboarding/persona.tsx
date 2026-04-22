import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#f6f8fc',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  option: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3f1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
});
