import 'server-only';

/**
 * Double opt-in confirmation for anonymous Business Connect enquiries.
 *
 * Submitters have no account, so we don't run a login or a one-time-code gate.
 * Instead the enquiry is saved as PENDING_CONFIRMATION with the SHA-256 hash of a
 * single-use token (see `BusinessConnectSubmission.emailConfirmationTokenHash`),
 * and a confirmation link is emailed to the contact address. Clicking it proves
 * the email is real and reachable and promotes the row to NEW. The manual admin
 * review remains the real trust gate; this only confirms email ownership.
 */

/** How long a confirmation link stays valid after the enquiry is submitted. */
export const CONFIRMATION_TTL_DAYS = 14;

/** Generate a cryptographically random, URL-safe confirmation token (hex). */
export function generateConfirmationToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the absolute confirmation URL emailed to the submitter. */
export function buildConfirmationUrl(routePath: string, token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${base}${routePath}/confirm?token=${encodeURIComponent(token)}`;
}

/** True when a token issued at `createdAt` is still within the validity window. */
export function isConfirmationFresh(createdAt: Date, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs <= CONFIRMATION_TTL_DAYS * 24 * 60 * 60 * 1000;
}
