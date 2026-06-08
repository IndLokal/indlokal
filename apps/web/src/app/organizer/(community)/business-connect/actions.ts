'use server';

import { revalidatePath } from 'next/cache';
import type { BusinessConnectStatus } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashToken, requireSessionUser } from '@/lib/session';
import { getCurrentCommunityId } from '@/lib/session';
import { resolveActiveOrganizerCommunity } from '@/lib/organizer/workspace';
import { canInviteCommunityCollaborators } from '@/lib/auth/community-permissions';
import { sendBusinessConnectInviteEmail } from '@/lib/email';
import { ACTIVE_BUSINESS_CONNECT_PROGRAM } from '@/app/jito-stuttgart/business-connect/pilot';
import { BUSINESS_CONNECT_STATUSES } from '@/app/jito-stuttgart/business-connect/options';
import {
  buildInviteUrl,
  generateInviteToken,
  inviteExpiresAt,
} from '@/app/jito-stuttgart/business-connect/invite';

const pilot = ACTIVE_BUSINESS_CONNECT_PROGRAM;

export type InviteBusinessConnectResult =
  | { success: true; message: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

const emailSchema = z.string().email();

function isValidStatus(value: string): value is BusinessConnectStatus {
  return (BUSINESS_CONNECT_STATUSES as readonly string[]).includes(value);
}

async function requireBusinessConnectOrganizerContext() {
  const user = await requireSessionUser();

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, currentId);
  if (!community) {
    throw new Error('No active community found.');
  }

  if (community.slug !== pilot.communitySlug) {
    throw new Error('Business Connect is not available for this community.');
  }

  if (!canInviteCommunityCollaborators(user, community.id)) {
    throw new Error('Only community admins can review Business Connect enquiries.');
  }

  return { user, community };
}

async function assertSubmissionInOrganizerCommunity(submissionId: string, communityId: string) {
  const submission = await db.businessConnectSubmission.findFirst({
    where: {
      id: submissionId,
      pilotSlug: pilot.slug,
      invite: { communityId },
      status: { not: 'PENDING_CONFIRMATION' },
    },
    select: { id: true },
  });
  if (!submission) {
    throw new Error('Business Connect enquiry not found for this organizer workspace.');
  }
}

/** Split a textarea of emails on commas / newlines / spaces and normalise. */
function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

export async function inviteBusinessConnectGuest(
  _prev: InviteBusinessConnectResult,
  formData: FormData,
): Promise<InviteBusinessConnectResult> {
  let user;
  let community;
  try {
    ({ user, community } = await requireBusinessConnectOrganizerContext());
  } catch (error) {
    return {
      success: false,
      errors: { _: [error instanceof Error ? error.message : 'Unable to invite guests.'] },
    };
  }

  const note = ((formData.get('note') as string) || '').trim() || null;
  const emails = parseEmails((formData.get('emails') as string) || '');

  if (emails.length === 0) {
    return { success: false, errors: { emails: ['Enter at least one email address.'] } };
  }
  if (emails.length > 50) {
    return { success: false, errors: { emails: ['Please invite at most 50 people at a time.'] } };
  }

  const invalid = emails.filter((email) => !emailSchema.safeParse(email).success);
  if (invalid.length > 0) {
    return {
      success: false,
      errors: { emails: [`These don't look like valid emails: ${invalid.join(', ')}`] },
    };
  }

  // Skip anyone who already has a live (unused, unexpired) invite for this pilot.
  const existing = await db.businessConnectInvite.findMany({
    where: {
      pilotSlug: pilot.slug,
      email: { in: emails },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { email: true },
  });
  const alreadyInvited = new Set(existing.map((row) => row.email));
  const toInvite = emails.filter((email) => !alreadyInvited.has(email));

  let sent = 0;
  const failedEmails: string[] = [];

  for (const email of toInvite) {
    const token = generateInviteToken();
    const tokenHash = await hashToken(token);
    let inviteId: string;

    try {
      const invite = await db.businessConnectInvite.create({
        data: {
          pilotSlug: pilot.slug,
          email,
          tokenHash,
          communityId: community.id,
          invitedByUserId: user.id,
          note,
          expiresAt: inviteExpiresAt(),
        },
      });
      inviteId = invite.id;
    } catch {
      continue;
    }

    // Await email delivery before counting as sent. If delivery fails, delete the
    // invite row so a future retry will work with a fresh token.
    try {
      await sendBusinessConnectInviteEmail(email, {
        inviteUrl: buildInviteUrl(pilot.routePath, token),
        eventLabel: pilot.eventLabel,
        partnerName: pilot.partnerName,
        inviterLabel: user.displayName ?? user.email,
      });
      sent += 1;
    } catch (error) {
      // Email delivery failed. Delete the invite row so the organizer can retry,
      // and the next attempt will generate a fresh token.
      await db.businessConnectInvite.delete({ where: { id: inviteId } }).catch(() => {});
      failedEmails.push(email);
    }
  }

  revalidatePath('/organizer/business-connect');

  const skipped = alreadyInvited.size;
  const parts = [`Invited ${sent} ${sent === 1 ? 'guest' : 'guests'}.`];

  if (skipped > 0) {
    parts.push(
      `${skipped} already had a pending invite and ${skipped === 1 ? 'was' : 'were'} skipped.`,
    );
  }

  if (failedEmails.length > 0) {
    parts.push(
      `Failed to send email to: ${failedEmails.join(', ')}. Please try again later.`,
    );
    return { success: false, errors: { _: [parts.join(' ')] } };
  }

  return { success: true, message: parts.join(' ') };
}

export async function updateBusinessConnectStatus(formData: FormData) {
  const { community } = await requireBusinessConnectOrganizerContext();
  const id = (formData.get('id') as string | null)?.trim();
  const status = (formData.get('status') as string | null)?.trim();
  if (!id || !status || !isValidStatus(status)) return;

  await assertSubmissionInOrganizerCommunity(id, community.id);

  await db.businessConnectSubmission.update({
    where: { id },
    data: { status },
  });

  revalidatePath('/organizer/business-connect');
  revalidatePath('/admin/business-connect');
}

export async function updateBusinessConnectNotes(formData: FormData) {
  const { community } = await requireBusinessConnectOrganizerContext();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) return;

  await assertSubmissionInOrganizerCommunity(id, community.id);

  const adminNotes = ((formData.get('adminNotes') as string) ?? '').trim();
  const matchNotes = ((formData.get('matchNotes') as string) ?? '').trim();

  await db.businessConnectSubmission.update({
    where: { id },
    data: {
      adminNotes: adminNotes || null,
      matchNotes: matchNotes || null,
    },
  });

  revalidatePath('/organizer/business-connect');
  revalidatePath('/admin/business-connect');
}
