/**
 * Image upload orchestration - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports) so it is unit-testable in Node. Given a
 * prepared file descriptor (uri + bytes + sha256 already computed by the Expo
 * wrapper), it:
 *   1. Requests a presigned PUT URL (POST /api/v1/uploads/presign).
 *   2. PUTs the bytes with the checksum header S3 expects.
 *   3. Returns the storage key to attach as `imageKey` on a submission.
 *
 * The S3 presign embeds `ChecksumSHA256`, so the PUT must send a matching
 * `x-amz-checksum-sha256` header (base64 of the raw 32-byte digest).
 */

import { submit as s } from '@indlokal/shared';

export interface PreparedImage {
  /** Local file uri (used only by the Expo wrapper for the PUT body). */
  uri: string;
  contentType: s.UploadContentType;
  sizeBytes: number;
  /** Hex-encoded SHA-256 of the file bytes. */
  sha256Hex: string;
  /** Base64 of the raw SHA-256 digest, for the x-amz-checksum-sha256 header. */
  sha256Base64: string;
}

export interface PresignClient {
  postAuthed<TReq extends Record<string, unknown>, TRes>(path: string, body: TReq): Promise<TRes>;
}

export type PutFn = (url: string, file: PreparedImage) => Promise<{ ok: boolean; status: number }>;

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public readonly stage: 'validate' | 'presign' | 'put',
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Validate a prepared image against the shared presign contract before any
 * network call. Throws ImageUploadError on the first problem.
 */
export function validatePreparedImage(file: PreparedImage): void {
  const parsedType = s.UploadContentType.safeParse(file.contentType);
  if (!parsedType.success) {
    throw new ImageUploadError(`unsupported image type: ${file.contentType}`, 'validate');
  }
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 1) {
    throw new ImageUploadError('image is empty', 'validate');
  }
  if (file.sizeBytes > MAX_IMAGE_BYTES) {
    throw new ImageUploadError('image exceeds the 10 MB limit', 'validate');
  }
  if (!/^[0-9a-f]{64}$/.test(file.sha256Hex)) {
    throw new ImageUploadError('invalid file hash', 'validate');
  }
}

/**
 * Upload a prepared image and return the storage key to attach as `imageKey`.
 */
export async function uploadImage(
  file: PreparedImage,
  deps: { client: PresignClient; put: PutFn },
): Promise<string> {
  validatePreparedImage(file);

  let presign: s.PresignResponse;
  try {
    const raw = await deps.client.postAuthed<
      s.PresignRequest & Record<string, unknown>,
      s.PresignResponse
    >('/api/v1/uploads/presign', {
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256Hex,
    });
    presign = s.PresignResponse.parse(raw);
  } catch (err) {
    throw new ImageUploadError(
      err instanceof Error ? err.message : 'could not prepare the upload',
      'presign',
    );
  }

  let result: { ok: boolean; status: number };
  try {
    result = await deps.put(presign.url, file);
  } catch (err) {
    throw new ImageUploadError(err instanceof Error ? err.message : 'upload failed', 'put');
  }
  if (!result.ok) {
    throw new ImageUploadError(`upload failed with status ${result.status}`, 'put');
  }

  return presign.key;
}
