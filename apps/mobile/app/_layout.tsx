import { Stack } from 'expo-router';
import 'react-native-reanimated';
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="auth/sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="auth/magic-link-sent" options={{ title: 'Check your email' }} />
      <Stack.Screen name="auth/onboarding/city" options={{ title: 'Pick your city' }} />
      <Stack.Screen name="auth/onboarding/persona" options={{ title: 'Tell us about you' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="me/profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="me/delete-account" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
