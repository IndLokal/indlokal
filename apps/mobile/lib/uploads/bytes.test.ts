import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { base64ToBytes, bytesToBase64, bytesToHex } from './bytes';

function nodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('uploads/bytes', () => {
  it('round-trips bytes through base64', () => {
    const samples = [
      new Uint8Array([]),
      new Uint8Array([0]),
      new Uint8Array([1, 2, 3]),
      new Uint8Array([255, 254, 253, 0, 1]),
      new Uint8Array(Array.from({ length: 200 }, (_, i) => i % 256)),
    ];
    for (const bytes of samples) {
      const b64 = bytesToBase64(bytes);
      assert.equal(b64, nodeBase64(bytes), 'matches node base64');
      assert.deepEqual(Array.from(base64ToBytes(b64)), Array.from(bytes));
    }
  });

  it('decodes a base64 string produced by node', () => {
    const original = Buffer.from('hello world! 🚀', 'utf8');
    const decoded = base64ToBytes(original.toString('base64'));
    assert.deepEqual(Array.from(decoded), Array.from(original));
  });

  it('hex matches node sha256 and base64 of digest matches', () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const hash = createHash('sha256').update(Buffer.from(data)).digest();
    assert.equal(bytesToHex(new Uint8Array(hash)), hash.toString('hex'));
    assert.equal(bytesToBase64(new Uint8Array(hash)), hash.toString('base64'));
  });
});
