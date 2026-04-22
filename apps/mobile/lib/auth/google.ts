import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '@indlokal/shared';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
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
  const redirectUri = AuthSession.makeRedirectUri({
    path: 'auth/google/callback',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: config.androidClientId,
    iosClientId: config.iosClientId,
    webClientId: config.webClientId,
    responseType: 'code',
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  return {
    request,
    response,
    promptAsync,
    redirectUri,
    enabled: Boolean(config.androidClientId || config.iosClientId || config.webClientId),
  };
}

export function configureNativeGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
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
