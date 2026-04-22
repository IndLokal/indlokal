import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notifications as n } from '@indlokal/shared';
import { authClient } from './auth/client.expo';

const INSTALLATION_ID_KEY = 'indlokal.installationId.v1';
const REMINDER_INDEX_KEY = 'indlokal.eventReminders.v1';
const REMINDER_LEAD_MS = 60 * 60 * 1000; // 1 hour

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

// ─── Local in-app event reminders ─────────────────────────────────────────
//
// PRD-0005: when a user saves an event we schedule a one-shot local
// notification 1h before it starts. These run client-side via
// expo-notifications and are independent of the server outbox so the
// reminder still fires even if push delivery is offline.

type ReminderIndex = Record<string, string>; // eventId -> notificationId

async function readReminderIndex(): Promise<ReminderIndex> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_INDEX_KEY);
    return raw ? (JSON.parse(raw) as ReminderIndex) : {};
  } catch {
    return {};
  }
}

async function writeReminderIndex(index: ReminderIndex): Promise<void> {
  await AsyncStorage.setItem(REMINDER_INDEX_KEY, JSON.stringify(index));
}

export type ScheduleReminderResult = 'scheduled' | 'too_soon' | 'no_permission' | 'error';

export async function scheduleEventReminder(
  eventId: string,
  title: string,
  startsAtIso: string,
): Promise<ScheduleReminderResult> {
  const startsAt = new Date(startsAtIso).getTime();
  if (Number.isNaN(startsAt)) return 'error';
  const fireAt = startsAt - REMINDER_LEAD_MS;
  if (fireAt <= Date.now()) return 'too_soon';

  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== Notifications.PermissionStatus.GRANTED) return 'no_permission';

  try {
    await cancelEventReminder(eventId);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Starting soon',
        body: `${title} starts in 1 hour.`,
        data: { eventId, kind: 'event-reminder' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
    });
    const index = await readReminderIndex();
    index[eventId] = id;
    await writeReminderIndex(index);
    return 'scheduled';
  } catch {
    return 'error';
  }
}

export async function cancelEventReminder(eventId: string): Promise<void> {
  const index = await readReminderIndex();
  const id = index[eventId];
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // notification may have already fired
  }
  delete index[eventId];
  await writeReminderIndex(index);
}

export async function hasEventReminder(eventId: string): Promise<boolean> {
  const index = await readReminderIndex();
  return Boolean(index[eventId]);
}
