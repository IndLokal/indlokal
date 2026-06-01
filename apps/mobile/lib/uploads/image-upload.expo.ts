/**
 * Expo image picker + upload wrapper - PRD/TDD-0040.
 *
 * Bridges the device camera/library to the pure `uploadImage` orchestrator.
 * Keeps all Expo/RN imports out of the unit-testable core (`upload.ts`,
 * `bytes.ts`). Computes the SHA-256 of the exact file bytes so the presigned
 * PUT's `x-amz-checksum-sha256` header matches what S3 will verify.
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { submit as s } from '@indlokal/shared';
import { authClient } from '@/lib/auth/client.expo';
import { base64ToBytes, bytesToBase64, bytesToHex } from './bytes';
import { uploadImage, ImageUploadError, type PreparedImage, type PutFn } from './upload';

const EXT_TO_CONTENT_TYPE: Record<string, s.UploadContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function inferContentType(uri: string, mimeType?: string | null): s.UploadContentType {
  if (mimeType && s.UploadContentType.safeParse(mimeType).success) {
    return mimeType as s.UploadContentType;
  }
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_CONTENT_TYPE[ext] ?? 'image/jpeg';
}

async function prepareFromAsset(asset: ImagePicker.ImagePickerAsset): Promise<PreparedImage> {
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileBytes = base64ToBytes(base64);
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileBytes as unknown as ArrayBuffer,
  );
  const hashBytes = new Uint8Array(digest);

  return {
    uri: asset.uri,
    contentType: inferContentType(asset.uri, asset.mimeType),
    sizeBytes: fileBytes.length,
    sha256Hex: bytesToHex(hashBytes),
    sha256Base64: bytesToBase64(hashBytes),
  };
}

const putViaFileSystem: PutFn = async (url, file) => {
  const res = await FileSystem.uploadAsync(url, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': file.contentType,
      'x-amz-checksum-sha256': file.sha256Base64,
    },
  });
  return { ok: res.status >= 200 && res.status < 300, status: res.status };
};

export type PickSource = 'library' | 'camera';

export interface PickedUploadResult {
  imageKey: string;
  previewUri: string;
  contentType: s.UploadContentType;
}

/**
 * Prompt for permission, let the user pick/capture an image, upload it, and
 * return the storage key to attach as `imageKey` on a submission. Returns
 * `null` if the user cancels. Throws ImageUploadError on failure.
 */
export async function pickAndUploadImage(
  source: PickSource = 'library',
): Promise<PickedUploadResult | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new ImageUploadError(
      source === 'camera'
        ? 'Camera permission is required to take a photo.'
        : 'Photo library permission is required to choose an image.',
      'validate',
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;

  const prepared = await prepareFromAsset(result.assets[0]);
  const imageKey = await uploadImage(prepared, {
    client: authClient,
    put: putViaFileSystem,
  });

  return { imageKey, previewUri: prepared.uri, contentType: prepared.contentType };
}

export { ImageUploadError };
