import * as AppleAuthentication from 'expo-apple-authentication';
import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

export async function signInWithApple(client: AuthClient) {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken || !credential.authorizationCode) {
    throw new Error('apple credential missing token fields');
  }

  const payload = auth.AppleAuth.parse({
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    user: {
      email: credential.email ?? undefined,
      name:
        credential.fullName?.givenName || credential.fullName?.familyName
          ? {
              firstName: credential.fullName?.givenName ?? undefined,
              lastName: credential.fullName?.familyName ?? undefined,
            }
          : undefined,
    },
  });

  const tokens = await client.postPublic<typeof payload, auth.AuthTokens>(
    '/api/v1/auth/apple',
    payload,
  );
  const parsed = auth.AuthTokens.parse(tokens);
  await client.setTokens(parsed);
  return parsed;
}
