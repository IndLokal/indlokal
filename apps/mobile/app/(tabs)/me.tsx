import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function MeTabScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>My account</Text>
        <Link href="/me/profile" style={styles.link}>
          View profile
        </Link>
        <Link href="/settings/notifications" style={styles.link}>
          Notification preferences
        </Link>
        <Link href="/inbox/index" style={styles.link}>
          Inbox
        </Link>
        <Link href="/me/delete-account" style={styles.link}>
          Delete account
        </Link>
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
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  link: {
    paddingVertical: 12,
    borderBottomColor: '#d8e0ee',
    borderBottomWidth: 1,
    color: '#0f172a',
    fontWeight: '500',
  },
});
