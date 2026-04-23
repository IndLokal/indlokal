import Constants from 'expo-constants';

const PROD_BASE_URL = 'https://indlokal.com';

function getExpoHost(): string | null {
  const expoHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  const legacyHostUri =
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    null;
  const hostUri = expoHostUri ?? legacyHostUri;
  if (!hostUri) return null;
  return hostUri.split(':')[0] ?? null;
}

function shouldReplaceLocalhost(configuredBaseUrl: string): boolean {
  const executionEnvironment = Constants.executionEnvironment;
  const isExpoGo = executionEnvironment === 'storeClient';
  const usesLocalhost =
    configuredBaseUrl.includes('localhost') || configuredBaseUrl.includes('127.0.0.1');
  return isExpoGo && usesLocalhost;
}

export function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const expoHost = getExpoHost();

  if (configuredBaseUrl) {
    if (expoHost && shouldReplaceLocalhost(configuredBaseUrl)) {
      return configuredBaseUrl.replace('localhost', expoHost).replace('127.0.0.1', expoHost);
    }
    return configuredBaseUrl;
  }

  if (expoHost) {
    return `http://${expoHost}:3001`;
  }

  return PROD_BASE_URL;
}
