/**
 * Upload storage client (S3 / Cloudflare R2).
 *
 * Uses the AWS SDK v3; Cloudflare R2 is S3-compatible so the same client
 * works for both.  The endpoint URL is optional — omit it for vanilla AWS S3.
 *
 * Environment variables:
 *   UPLOAD_BUCKET             — bucket name
 *   UPLOAD_REGION             — region (default: "auto" for R2)
 *   UPLOAD_ENDPOINT           — custom endpoint URL (R2: https://<accountId>.r2.cloudflarestorage.com)
 *   UPLOAD_ACCESS_KEY_ID      — access key
 *   UPLOAD_SECRET_ACCESS_KEY  — secret key
 *   UPLOAD_PUBLIC_URL_BASE    — base URL for public object access (e.g. https://cdn.indlokal.com)
 *   UPLOAD_PRESIGN_TTL_SECONDS — how long presigned PUT URLs are valid (default: 300)
 */

import { S3Client } from '@aws-sdk/client-s3';

function buildS3Client(): S3Client {
  const region = process.env.UPLOAD_REGION ?? 'auto';
  const endpoint = process.env.UPLOAD_ENDPOINT;

  return new S3Client({
    region,
    ...(endpoint && { endpoint, forcePathStyle: false }),
    credentials: {
      accessKeyId: process.env.UPLOAD_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.UPLOAD_SECRET_ACCESS_KEY ?? '',
    },
  });
}

// Singleton — re-used across requests
let _client: S3Client | undefined;
export function getS3Client(): S3Client {
  if (!_client) _client = buildS3Client();
  return _client;
}

export const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET ?? '';
export const UPLOAD_PUBLIC_URL_BASE = process.env.UPLOAD_PUBLIC_URL_BASE ?? '';
export const UPLOAD_PRESIGN_TTL_SECONDS = parseInt(
  process.env.UPLOAD_PRESIGN_TTL_SECONDS ?? '300',
  10,
);
