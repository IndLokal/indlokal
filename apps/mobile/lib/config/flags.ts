type AuthMethodFlag = {
  enabled: boolean;
};

export const authFlags: {
  apple: AuthMethodFlag;
  google: AuthMethodFlag;
  magic: AuthMethodFlag;
} = {
  apple: { enabled: process.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED !== 'false' },
  google: { enabled: process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED !== 'false' },
  magic: { enabled: process.env.EXPO_PUBLIC_AUTH_MAGIC_ENABLED !== 'false' },
};
