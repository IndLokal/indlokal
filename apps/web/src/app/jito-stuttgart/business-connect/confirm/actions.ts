'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import {
  sendBusinessConnectConfirmationEmail,
  sendBusinessConnectAdminNotificationEmail,
} from '@/lib/email';
import { LOOKING_FOR_LABELS, OFFERING_LABELS, PARTICIPANT_TYPE_LABELS } from '../options';
import { ACTIVE_BUSINESS_CONNECT_PILOT, getBusinessConnectPilot } from '../pilot';
import { isConfirmationFresh } from '../submit/confirmation';

const labelList = (
  values: string[],
  map: Record<string, string>,
  other?: string | null,
): string => {
  const labels = (values ?? []).map((v) => map[v] ?? v);
  if (other) labels.push(other);
  return labels.length ? labels.join(', ') : '—';
};

/**
 * Confirm an enquiry's contact email (double opt-in). Invoked from the confirm
 * page's button so it's a POST (robust against email link prefetch/scanners).
 * Promotes the row from PENDING_CONFIRMATION to NEW and fires the (best-effort)
 * confirmation + team-notification emails — the moment the enquiry truly enters
 * the manual review queue.
 */
export async function confirmBusinessConnectEnquiry(formData: FormData): Promise<void> {
  const token = (formData.get('token') as string | null)?.trim();
  const fallbackRoute = ACTIVE_BUSINESS_CONNECT_PILOT.routePath;

  if (!token) redirect(`${fallbackRoute}/confirm?state=invalid`);

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const tokenHash = await hashToken(token);
  const submission = await db.businessConnectSubmission.findUnique({
    where: { emailConfirmationTokenHash: tokenHash },
    include: {
      invite: {
        select: {
          invitedBy: { select: { email: true } },
        },
      },
    },
  });

  if (!submission || !isConfirmationFresh(submission.createdAt)) {
    redirect(`${fallbackRoute}/confirm?state=invalid`);
  }

  const pilot = getBusinessConnectPilot(submission.pilotSlug) ?? ACTIVE_BUSINESS_CONNECT_PILOT;

  // Idempotent: a second click on an already-confirmed link is a no-op.
  if (submission.emailConfirmedAt) {
    redirect(`${pilot.routePath}/confirm?state=done`);
  }

  await db.businessConnectSubmission.update({
    where: { id: submission.id },
    data: { emailConfirmedAt: new Date(), status: 'NEW' },
  });

  await captureServerEvent(ip, Events.BUSINESS_CONNECT_SUBMIT_SUCCESS, {
    pilotSlug: pilot.slug,
    participantType: submission.participantType,
    attendingEvent: submission.attendingEvent,
    isPartnerMember: submission.isPartnerMember,
  });

  // Best-effort emails: failures must never break the confirmation.
  const teamEmail =
    submission.invite?.invitedBy?.email ??
    process.env.BUSINESS_CONNECT_NOTIFY_EMAIL ??
    process.env.ADMIN_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    'admin@indlokal.com';

  void sendBusinessConnectConfirmationEmail(submission.contactEmail, {
    contactName: submission.contactName,
    partnerName: pilot.partnerName,
    eventLabel: pilot.eventLabel,
    companyName: submission.companyName,
  }).catch(() => {
    // Non-critical: submitter confirmation failed to send.
  });

  void sendBusinessConnectAdminNotificationEmail(teamEmail, {
    partnerName: pilot.partnerName,
    eventLabel: pilot.eventLabel,
    companyName: submission.companyName,
    participantType:
      PARTICIPANT_TYPE_LABELS[submission.participantType] ?? submission.participantType,
    country: submission.country,
    city: submission.city,
    industry: submission.industry,
    contactName: submission.contactName,
    contactEmail: submission.contactEmail,
    lookingFor: labelList(submission.lookingFor, LOOKING_FOR_LABELS, submission.lookingForOther),
    offering: labelList(submission.offering, OFFERING_LABELS, submission.offeringOther),
    specificAsk: submission.specificAsk,
  }).catch(() => {
    // Non-critical: team notification failed to send.
  });

  redirect(`${pilot.routePath}/confirm?state=done`);
}
