/**
 * Byte/encoding helpers for image hashing - PRD/TDD-0040.
 *
 * Pure, dependency-free, unit-testable in Node. Used by the Expo upload
 * wrapper to convert between base64 file contents, raw bytes, hex, and the
 * base64 checksum S3 expects.
 */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i += 1) B64_LOOKUP[B64_ALPHABET[i]] = i;

/** Decode a standard base64 string into raw bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const len = (clean.length * 3) / 4 - padding;
  const bytes = new Uint8Array(len);

  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean[i]] ?? 0;
    const c1 = B64_LOOKUP[clean[i + 1]] ?? 0;
    const c2 = B64_LOOKUP[clean[i + 2]] ?? 0;
    const c3 = B64_LOOKUP[clean[i + 3]] ?? 0;

    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < len) bytes[p++] = (triple >> 16) & 0xff;
    if (p < len) bytes[p++] = (triple >> 8) & 0xff;
    if (p < len) bytes[p++] = triple & 0xff;
  }
  return bytes;
}

/** Encode raw bytes into a standard base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;

    out += B64_ALPHABET[(triple >> 18) & 0x3f];
    out += B64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? B64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? B64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
}

/** Lowercase hex encoding of raw bytes. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
