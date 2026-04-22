import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from './auth/client.expo';

const INSTALLATION_ID_KEY = 'indlokal.installationId.v1';

type PushPermissionStatus = 'granted' | 'denied' | 'provisional';

type RequestPermissionResult = {
  permissionStatus: PushPermissionStatus;
  expoPushToken: string | null;
  registered: boolean;
};

function mapPlatform(): n.DevicePlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

function createInstallationId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `inst_${Date.now()}_${random}`;
}

async function getInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const next = createInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, next);
  return next;
}

function toPermissionStatus(status: Notifications.PermissionStatus | string): PushPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === 'provisional') return 'provisional';
  return 'denied';
}

async function registerDevice(expoPushToken: string | null): Promise<boolean> {
  const installationId = await getInstallationId();

  const payload = n.DeviceRegister.parse({
    installationId,
    platform: mapPlatform(),
    expoPushToken: expoPushToken ?? undefined,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appVersion: Constants.expoConfig?.version,
  });

  try {
    const device = await authClient.postAuthed<typeof payload, n.Device>(
      '/api/v1/devices',
      payload,
    );
    n.Device.parse(device);
    return true;
  } catch {
    return false;
  }
}

export function usePushPermission() {
  async function requestPermission(): Promise<RequestPermissionResult> {
    const existing = await Notifications.getPermissionsAsync();
    const permissions =
      existing.status === Notifications.PermissionStatus.UNDETERMINED
        ? await Notifications.requestPermissionsAsync()
        : existing;

    const permissionStatus = toPermissionStatus(permissions.status);

    if (permissionStatus === 'denied') {
      await registerDevice(null);
      return {
        permissionStatus,
        expoPushToken: null,
        registered: false,
      };
    }

    let expoPushToken: string | null = null;
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync();
      expoPushToken = tokenResult.data;
    } catch {
      expoPushToken = null;
    }

    const registered = await registerDevice(expoPushToken);
    return {
      permissionStatus,
      expoPushToken,
      registered,
    };
  }

  return {
    requestPermission,
  };
}
