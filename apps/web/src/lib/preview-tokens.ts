import crypto from 'crypto';

const ALGO = 'sha256';

function base64url(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePreviewToken(eventId: string, hours = 24): string {
  const secret = process.env.EVENT_PREVIEW_SECRET ?? '';
  if (!secret) throw new Error('EVENT_PREVIEW_SECRET not configured');
  const exp = Math.floor(Date.now() / 1000) + hours * 60 * 60;
  const payload = `${eventId}.${exp}`;
  const sig = crypto.createHmac(ALGO, secret).update(payload).digest();
  return `${payload}.${base64url(sig)}`;
}

export function verifyPreviewToken(token: string): string | null {
  try {
    const secret = process.env.EVENT_PREVIEW_SECRET ?? '';
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [eventId, expStr, sigB64] = parts;
    const exp = Number(expStr);
    if (Number.isNaN(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const payload = `${eventId}.${exp}`;
    const expected = crypto.createHmac(ALGO, secret).update(payload).digest();
    const provided = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (provided.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(provided, expected)) return null;
    return eventId;
  } catch (e) {
    return null;
  }
}
