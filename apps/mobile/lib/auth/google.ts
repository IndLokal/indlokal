import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

WebBrowser.maybeCompleteAuthSession();

type GoogleOAuthConfig = {
  androidClientId?: string;
  iosClientId?: string;
  webClientId?: string;
};

function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };
}

export function useGoogleCodeFlow() {
  const config = getGoogleOAuthConfig();
  const platformClientId =
    Platform.OS === 'ios'
      ? config.iosClientId
      : Platform.OS === 'android'
        ? config.androidClientId
        : config.webClientId;

  const redirectUri = AuthSession.makeRedirectUri({
    path: 'auth/google/callback',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    // Keep provider config defined on every platform to avoid render-time throws
    // when a platform-specific client ID is missing in local env configuration.
    androidClientId: config.androidClientId ?? '',
    iosClientId: config.iosClientId ?? '',
    webClientId: config.webClientId ?? '',
    responseType: 'code',
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  return {
    request,
    response,
    promptAsync,
    redirectUri,
    enabled: Boolean(platformClientId),
  };
}

export async function signInWithGoogleCode(
  client: AuthClient,
  input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  },
) {
  const payload = auth.GoogleAuth.parse(input);
  const tokens = await client.postPublic<typeof payload, auth.AuthTokens>(
    '/api/v1/auth/google',
    payload,
  );
  const parsed = auth.AuthTokens.parse(tokens);
  await client.setTokens(parsed);
  return parsed;
}
