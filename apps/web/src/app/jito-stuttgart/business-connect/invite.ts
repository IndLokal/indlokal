import 'server-only';

/**
 * Invite-only access for Business Connect.
 *
 * Business Connect is NOT a public form. The pilot's community organizer
 * (COMMUNITY_ADMIN of the linked community) issues a per-email invite; only a
 * valid, unexpired, unused invite token unlocks the submit form, with the
 * contact email locked to the invited address. Only the SHA-256 hash of the
 * token is stored (see `BusinessConnectInvite.tokenHash`); the raw token lives
 * only in the emailed link. This keeps the pilot off the open web and ties every
 * enquiry to a guest the organizer chose.
 */

/** How long an invite link stays valid after the organizer issues it. */
export const INVITE_TTL_DAYS = 30;

/** Generate a cryptographically random, URL-safe invite token (hex). */
export function generateInviteToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the absolute invite URL emailed to the guest (opens the submit form). */
export function buildInviteUrl(routePath: string, token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${base}${routePath}/submit?invite=${encodeURIComponent(token)}`;
}

/** Compute the validity expiry for an invite issued at `from`. */
export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * True when an invite can still admit a submission: it has not been used and has
 * not expired. Pass the persisted `usedAt` / `expiresAt` fields.
 */
export function isInviteUsable(
  invite: { usedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  if (invite.usedAt) return false;
  return invite.expiresAt.getTime() > now.getTime();
}
