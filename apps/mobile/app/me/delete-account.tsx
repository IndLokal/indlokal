import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '@/constants/theme';

export default function DeleteAccountScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Delete account</Text>
        <Text style={styles.text}>
          This permanently removes your profile and saved items. This action cannot be undone.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            Alert.alert(
              'Delete account',
              'Account deletion endpoint will be connected in a follow-up task.',
            );
          }}
        >
          <Text style={styles.buttonText}>Delete account</Text>
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
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '700',
    color: palette.neutral.foreground,
  },
  text: {
    color: palette.neutral.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: palette.status.destructive,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.body,
  },
});
