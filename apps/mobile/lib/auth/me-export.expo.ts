import * as FileSystem from 'expo-file-system/legacy';
import type { AuthClient } from './client';
import { buildMeExportFileName, fetchMeExport, serializeMeExport } from './me-export';

export type MeExportFile = {
  fileName: string;
  uri: string;
  sizeBytes: number;
};

/**
 * Download authenticated me-export JSON and persist it in app documents.
 */
export async function exportMeDataToFile(
  client: Pick<AuthClient, 'getAuthed'>,
  now: Date = new Date(),
): Promise<MeExportFile> {
  const payload = await fetchMeExport(client);
  const content = serializeMeExport(payload);

  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('Local file storage is unavailable on this device.');
  }

  const fileName = buildMeExportFileName(now);
  const uri = `${directory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('Data export file could not be written.');
  }

  return {
    fileName,
    uri,
    sizeBytes: info.size ?? content.length,
  };
}
