import { auth } from '@indlokal/shared';
import type { AuthClient } from './client';

export function buildMeExportFileName(now: Date = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, '-');
  return `indlokal-me-export-${iso}.json`;
}

export function serializeMeExport(data: auth.MeDataExport): string {
  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Fetch and validate the GDPR portability payload for the authenticated user.
 */
export async function fetchMeExport(
  client: Pick<AuthClient, 'getAuthed'>,
): Promise<auth.MeDataExport> {
  const response = await client.getAuthed<auth.MeDataExport>('/api/v1/me/export');
  return auth.MeDataExport.parse(response);
}
