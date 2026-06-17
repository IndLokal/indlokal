import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { authClient } from '@/lib/auth/client.expo';
import { extractMagicLinkToken } from '@/lib/auth/magic';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';

// Hold the native splash until session restore finishes.
SplashScreen.preventAutoHideAsync();

function handleIncomingUrl(url: string | null) {
  if (!url) return;
  // Universal Link / scheme → magic link token
  if (/\/auth\/magic(\?|$)/.test(url)) {
    const token = extractMagicLinkToken(url);
    if (token) {
      router.push({ pathname: '/auth/magic-link/verify', params: { token } });
    }
    return;
  }
  // Universal Link → /:city/events/:slug or /:city/communities/:slug
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 3 && segments[1] === 'events') {
      router.push({ pathname: '/events/[slug]', params: { slug: segments[2] } });
    } else if (segments.length === 3 && segments[1] === 'communities') {
      router.push({ pathname: '/communities/[slug]', params: { slug: segments[2] } });
    }
  } catch {
    // ignore unparseable URLs
  }
}

/**
 * Reads auth state after session restore and routes the user to onboarding
 * if their account is not yet complete. Lives inside the navigation tree
 * so it has access to the router.
 */
function OnboardingGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments() as string[];

  // Hide the native splash once session restore completes (success or failure).
  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    const onOnboarding =
      segments[0] === 'auth' && (segments[1] === 'onboarding' || segments[1] === 'magic-link');

    if (!user.onboardingComplete && !onOnboarding) {
      router.replace('/auth/onboarding/city');
    }
  }, [user, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  // Keep authClient referenced so module-side effects (token store) initialize.
  void authClient;

  useEffect(() => {
    void Linking.getInitialURL().then(handleIncomingUrl);
    const sub = Linking.addEventListener('url', (event) => handleIncomingUrl(event.url));
    return () => sub.remove();
  }, []);

  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="auth/sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/magic-link-sent" options={{ title: 'Check your email' }} />
        <Stack.Screen name="auth/magic-link/verify" options={{ title: 'Signing you in' }} />
        <Stack.Screen name="auth/onboarding/city" options={{ title: 'Pick your city' }} />
        <Stack.Screen name="auth/onboarding/persona" options={{ title: 'Tell us about you' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="events/[slug]" options={{ title: 'Event' }} />
        <Stack.Screen name="communities/[slug]" options={{ title: 'Community' }} />
        <Stack.Screen name="resources" options={{ title: 'Resources' }} />
        <Stack.Screen name="search/results" options={{ title: 'Results' }} />
        <Stack.Screen name="submit/index" options={{ title: 'Submit' }} />
        <Stack.Screen name="submit/event" options={{ title: 'Submit event' }} />
        <Stack.Screen name="submit/community" options={{ title: 'Add community' }} />
        <Stack.Screen name="submit/contribute" options={{ title: 'Contribute community' }} />
        <Stack.Screen
          name="report/community/[id]"
          options={{ title: 'Report', presentation: 'modal' }}
        />
        <Stack.Screen name="me/profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="me/delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen
          name="settings/notifications/quiet-hours"
          options={{ title: 'Quiet hours' }}
        />
        <Stack.Screen name="inbox/index" options={{ title: 'Inbox' }} />
      </Stack>
      <OnboardingGate />
    </AuthProvider>
  );
}
