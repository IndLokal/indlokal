import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PushPrePromptCard } from '@/components/PushPrePromptCard';
import { usePushPromptStore } from '@/lib/push-prompt-store';

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
    backgroundColor: '#f6f8fc',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  text: {
    color: '#475569',
    fontSize: 16,
  },
  promptButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  promptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
