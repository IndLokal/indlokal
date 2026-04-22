/**
 * Maps a Prisma `Device` row to the `Device` contract.
 */

import type { Device as DeviceRow } from '@prisma/client';
import type { notifications as n } from '@indlokal/shared';

export function toDeviceContract(row: DeviceRow): n.Device {
  return {
    id: row.id,
    installationId: row.installationId,
    platform: row.platform,
    expoPushToken: row.expoPushToken,
    locale: row.locale,
    timezone: row.timezone,
    appVersion: row.appVersion,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
