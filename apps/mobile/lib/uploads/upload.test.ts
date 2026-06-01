import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  uploadImage,
  validatePreparedImage,
  ImageUploadError,
  MAX_IMAGE_BYTES,
  type PreparedImage,
  type PresignClient,
  type PutFn,
} from './upload';

const HEX64 = 'a'.repeat(64);

function makeImage(overrides: Partial<PreparedImage> = {}): PreparedImage {
  return {
    uri: 'file:///tmp/photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1234,
    sha256Hex: HEX64,
    sha256Base64: 'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=',
    ...overrides,
  };
}

const presignOk: PresignClient = {
  async postAuthed() {
    return {
      url: 'https://s3.example.com/upload?sig=1',
      key: 'uploads/abc.jpg',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } as never;
  },
};

const putOk: PutFn = async () => ({ ok: true, status: 200 });

describe('uploads/upload validate', () => {
  it('rejects unsupported content types', () => {
    assert.throws(
      () => validatePreparedImage(makeImage({ contentType: 'image/gif' as never })),
      (e: unknown) => e instanceof ImageUploadError && e.stage === 'validate',
    );
  });

  it('rejects empty and oversized files', () => {
    assert.throws(() => validatePreparedImage(makeImage({ sizeBytes: 0 })), ImageUploadError);
    assert.throws(
      () => validatePreparedImage(makeImage({ sizeBytes: MAX_IMAGE_BYTES + 1 })),
      ImageUploadError,
    );
  });

  it('rejects a malformed hash', () => {
    assert.throws(() => validatePreparedImage(makeImage({ sha256Hex: 'nope' })), ImageUploadError);
  });

  it('accepts a valid image', () => {
    assert.doesNotThrow(() => validatePreparedImage(makeImage()));
  });
});

describe('uploads/upload orchestration', () => {
  it('returns the storage key on success and sends contract fields to presign', async () => {
    let sentBody: Record<string, unknown> | undefined;
    const client: PresignClient = {
      async postAuthed(_path, body) {
        sentBody = body;
        return {
          url: 'https://s3.example.com/u',
          key: 'uploads/key-1.jpg',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        } as never;
      },
    };
    const key = await uploadImage(makeImage(), { client, put: putOk });
    assert.equal(key, 'uploads/key-1.jpg');
    assert.deepEqual(sentBody, {
      contentType: 'image/jpeg',
      sizeBytes: 1234,
      sha256: HEX64,
    });
  });

  it('wraps presign failures', async () => {
    const client: PresignClient = {
      async postAuthed() {
        throw new Error('boom');
      },
    };
    await assert.rejects(
      uploadImage(makeImage(), { client, put: putOk }),
      (e: unknown) => e instanceof ImageUploadError && e.stage === 'presign',
    );
  });

  it('wraps a non-ok PUT response', async () => {
    const put: PutFn = async () => ({ ok: false, status: 403 });
    await assert.rejects(
      uploadImage(makeImage(), { client: presignOk, put }),
      (e: unknown) => e instanceof ImageUploadError && e.stage === 'put',
    );
  });

  it('does not call presign when validation fails', async () => {
    let called = false;
    const client: PresignClient = {
      async postAuthed() {
        called = true;
        return {} as never;
      },
    };
    await assert.rejects(
      uploadImage(makeImage({ sizeBytes: 0 }), { client, put: putOk }),
      ImageUploadError,
    );
    assert.equal(called, false);
  });
});
