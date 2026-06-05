'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { checkRateLimit, businessConnectLimiter } from '@/lib/rate-limit';
import { sendBusinessConnectConfirmEmail } from '@/lib/email';
import { businessConnectSubmissionSchema } from '../schema';
import { ACTIVE_BUSINESS_CONNECT_PILOT, getBusinessConnectPilot } from '../pilot';
import { isInviteUsable } from '../invite';
import {
  generateConfirmationToken,
  buildConfirmationUrl,
  isConfirmationFresh,
} from './confirmation';

export type BusinessConnectResult =
  // Enquiry saved (PENDING_CONFIRMATION); a confirmation link was emailed and must
  // be clicked before the enquiry reaches the review team (double opt-in).
  | { status: 'success' }
  // Form validation / rate-limit / persistence failure on the enquiry itself.
  | { status: 'error'; errors: Record<string, string[]> }
  | null;

const optional = (value: FormDataEntryValue | null): string | undefined => {
  const trimmed = (value as string | null)?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Submit a Business Connect pilot enquiry.
 *
 * Invite-only by design. The form is unreachable without a valid per-email invite
 * issued by the pilot's community organizer; the raw invite token arrives in a
 * locked hidden field. We re-validate it server-side, force the contact email to
 * the invited address, and mark the invite used when the enquiry is saved.
 *
 * Submitters are still anonymous (there is no public account), so we also use
 * double opt-in: the enquiry is saved as PENDING_CONFIRMATION with the hash of a
 * single-use token and a confirmation link is emailed to the contact address. The
 * enquiry only becomes a reviewable record (status NEW) once that link is clicked
 * — see `confirm/actions.ts`.
 *
 * Submissions are NEVER auto-published, listed publicly, or auto-matched; review
 * and introductions are manual and remain the real trust gate. The owning pilot is
 * resolved from the invite (not client input), so the same action serves every pilot.
 */
export async function submitBusinessConnect(
  _prev: BusinessConnectResult,
  formData: FormData,
): Promise<BusinessConnectResult> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // Invite-only: the form is unreachable without a valid per-email invite. The
  // token comes from the locked hidden field the submit page injected; we never
  // trust a client-supplied pilot or email — both come from the invite.
  const inviteToken = (formData.get('inviteToken') as string | null)?.trim();
  if (!inviteToken) {
    return {
      status: 'error',
      errors: { _: ['This enquiry form is invite-only. Please open it from your invite email.'] },
    };
  }

  const inviteTokenHash = await hashToken(inviteToken);
  const invite = await db.businessConnectInvite.findUnique({
    where: { tokenHash: inviteTokenHash },
    select: { id: true, email: true, pilotSlug: true, usedAt: true, expiresAt: true },
  });
  if (!invite || !isInviteUsable(invite)) {
    return {
      status: 'error',
      errors: {
        _: ['This invite link is no longer valid. Please ask your organizer for a new one.'],
      },
    };
  }

  const pilot = getBusinessConnectPilot(invite.pilotSlug) ?? ACTIVE_BUSINESS_CONNECT_PILOT;

  const raw = {
    participantType: (formData.get('participantType') as string) ?? '',
    lookingFor: formData.getAll('lookingFor') as string[],
    lookingForOther: optional(formData.get('lookingForOther')),
    offering: formData.getAll('offering') as string[],
    offeringOther: optional(formData.get('offeringOther')),
    companyName: (formData.get('companyName') as string) ?? '',
    country: (formData.get('country') as string) ?? '',
    city: (formData.get('city') as string) ?? '',
    industry: (formData.get('industry') as string) ?? '',
    businessDescription: (formData.get('businessDescription') as string) ?? '',
    specificAsk: (formData.get('specificAsk') as string) ?? '',
    contactName: (formData.get('contactName') as string) ?? '',
    // The contact email is locked to the invite — never trust the posted value.
    contactEmail: invite.email,
    website: optional(formData.get('website')),
    linkedinUrl: optional(formData.get('linkedinUrl')),
    phone: optional(formData.get('phone')),
    preferredGeography: optional(formData.get('preferredGeography')),
    attendingEvent: (formData.get('attendingEvent') as string) ?? '',
    isPartnerMember: (formData.get('isPartnerMember') as string) ?? '',
    referredBy: optional(formData.get('referredBy')),
    associatedChapterOrOrg: optional(formData.get('associatedChapterOrOrg')),
    consentToReview: formData.get('consentToReview') === 'on',
    consentManualIntroUnderstanding: formData.get('consentManualIntroUnderstanding') === 'on',
    consentToShareSelectedInfo: formData.get('consentToShareSelectedInfo') === 'on',
  };

  const parsed = businessConnectSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    await captureServerEvent(ip, Events.BUSINESS_CONNECT_SUBMIT_ERROR, {
      pilotSlug: pilot.slug,
      reason: 'validation',
    });
    return {
      status: 'error',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Per-IP anti-abuse. Kept loose for shared event WiFi; the double opt-in
  // confirmation and manual review are the substantive gates.
  if (!checkRateLimit(businessConnectLimiter, ip).allowed) {
    await captureServerEvent(ip, Events.BUSINESS_CONNECT_SUBMIT_ERROR, {
      pilotSlug: pilot.slug,
      reason: 'rate_limited',
    });
    return {
      status: 'error',
      errors: { _: ['Too many submissions from this network. Please try again later.'] },
    };
  }

  // Single-use confirmation token. Only its hash is stored; the raw token lives
  // solely in the emailed link.
  const token = generateConfirmationToken();
  const tokenHash = await hashToken(token);
  const submitterEmail = data.contactEmail.toLowerCase();

  try {
    // Atomically consume the invite and create the enquiry, so one invite can
    // produce at most one submission even under concurrent submits.
    await db.$transaction(async (tx) => {
      const claimed = await tx.businessConnectInvite.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error('INVITE_CONSUMED');
      }

      await tx.businessConnectSubmission.create({
        data: {
          pilotSlug: pilot.slug,
          participantType: data.participantType,
          lookingFor: data.lookingFor,
          lookingForOther: data.lookingForOther || null,
          offering: data.offering,
          offeringOther: data.offeringOther || null,
          companyName: data.companyName,
          country: data.country,
          city: data.city,
          industry: data.industry,
          businessDescription: data.businessDescription,
          specificAsk: data.specificAsk,
          contactName: data.contactName,
          contactEmail: submitterEmail,
          website: data.website || null,
          linkedinUrl: data.linkedinUrl || null,
          phone: data.phone || null,
          preferredGeography: data.preferredGeography || null,
          attendingEvent: data.attendingEvent,
          isPartnerMember: data.isPartnerMember,
          referredBy: data.referredBy || null,
          associatedChapterOrOrg: data.associatedChapterOrOrg || null,
          consentToReview: data.consentToReview,
          consentManualIntroUnderstanding: data.consentManualIntroUnderstanding,
          consentToShareSelectedInfo: data.consentToShareSelectedInfo,
          consentPolicyVersion: pilot.consentPolicyVersion,
          emailConfirmationTokenHash: tokenHash,
          inviteId: invite.id,
          // status defaults to PENDING_CONFIRMATION until the email is confirmed.
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVITE_CONSUMED') {
      return {
        status: 'error',
        errors: {
          _: ['This invite has already been used. Please ask your organizer for a new one.'],
        },
      };
    }
    await captureServerEvent(ip, Events.BUSINESS_CONNECT_SUBMIT_ERROR, {
      pilotSlug: pilot.slug,
      reason: 'persist_failed',
    });
    return {
      status: 'error',
      errors: { _: ['Something went wrong saving your enquiry. Please try again.'] },
    };
  }

  // Best-effort: a delivery failure must never fail the submission. The submitter
  // can re-submit to get a fresh link.
  void sendBusinessConnectConfirmEmail(submitterEmail, {
    confirmUrl: buildConfirmationUrl(pilot.routePath, token),
    eventLabel: pilot.eventLabel,
    partnerName: pilot.partnerName,
    companyName: data.companyName,
  }).catch(() => {
    // Non-critical transport failure.
  });

  // Analytics: non-sensitive properties only. Submission started (pending email
  // confirmation); the SUCCESS event fires once the email is confirmed.
  await captureServerEvent(ip, Events.BUSINESS_CONNECT_SUBMIT_STARTED, {
    pilotSlug: pilot.slug,
    participantType: data.participantType,
    attendingEvent: data.attendingEvent,
    isPartnerMember: data.isPartnerMember,
  });

  return { status: 'success' };
}

/**
 * Resend the double-opt-in confirmation email for an already-submitted (but not
 * yet confirmed) enquiry. Requires the original invite token from the URL.
 */
export async function resendBusinessConnectConfirmation(formData: FormData): Promise<void> {
  const inviteToken = (formData.get('inviteToken') as string | null)?.trim();
  const fallbackRoute = ACTIVE_BUSINESS_CONNECT_PILOT.routePath;

  if (!inviteToken) {
    redirect(`${fallbackRoute}/submit?resent=invalid`);
  }

  const inviteTokenHash = await hashToken(inviteToken);
  const invite = await db.businessConnectInvite.findUnique({
    where: { tokenHash: inviteTokenHash },
    select: {
      email: true,
      pilotSlug: true,
      submission: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          emailConfirmedAt: true,
          companyName: true,
        },
      },
    },
  });

  const pilot = invite
    ? (getBusinessConnectPilot(invite.pilotSlug) ?? ACTIVE_BUSINESS_CONNECT_PILOT)
    : ACTIVE_BUSINESS_CONNECT_PILOT;
  const returnHref = `${pilot.routePath}/submit?invite=${encodeURIComponent(inviteToken)}`;

  if (!invite || !invite.submission) {
    redirect(`${returnHref}&resent=invalid`);
  }

  const submission = invite.submission;
  if (submission.emailConfirmedAt || submission.status !== 'PENDING_CONFIRMATION') {
    redirect(`${returnHref}&resent=already`);
  }

  if (!isConfirmationFresh(submission.createdAt)) {
    redirect(`${returnHref}&resent=expired`);
  }

  const token = generateConfirmationToken();
  const tokenHash = await hashToken(token);

  await db.businessConnectSubmission.update({
    where: { id: submission.id },
    data: { emailConfirmationTokenHash: tokenHash },
  });

  void sendBusinessConnectConfirmEmail(invite.email.toLowerCase(), {
    confirmUrl: buildConfirmationUrl(pilot.routePath, token),
    eventLabel: pilot.eventLabel,
    partnerName: pilot.partnerName,
    companyName: submission.companyName,
  }).catch(() => {
    // Non-critical transport failure.
  });

  redirect(`${returnHref}&resent=ok`);
}
