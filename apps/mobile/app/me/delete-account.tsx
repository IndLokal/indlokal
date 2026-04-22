import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#fff5f5',
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#7f1d1d',
  },
  text: {
    color: '#7f1d1d',
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#991b1b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
