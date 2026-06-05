import { format } from 'date-fns';
import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth/permissions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import {
  LOOKING_FOR_LABELS,
  OFFERING_LABELS,
  PARTICIPANT_TYPE_LABELS,
  YES_NO_NOT_SURE_LABELS,
  businessConnectPilotLabel,
} from '@/app/jito-stuttgart/business-connect/options';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-700',
  REVIEWED: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-purple-100 text-purple-700',
  MATCHED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

function labelList(values: string[], map: Record<string, string>): string {
  if (!values || values.length === 0) return '—';
  return values.map((v) => map[v] ?? v).join(', ');
}

export default async function AdminBusinessConnectPage() {
  await requireCan('business_connect.read');

  const submissions = await db.businessConnectSubmission.findMany({
    // Exclude PENDING_CONFIRMATION: those are saved but the contact email has not
    // completed double opt-in yet, so they are not real (reviewable) enquiries.
    where: { status: { not: 'PENDING_CONFIRMATION' } },
    orderBy: { createdAt: 'desc' },
  });

  type Row = (typeof submissions)[number];

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        title="Business Connect"
        description={`${submissions.length} enquir${submissions.length === 1 ? 'y' : 'ies'} · private · organizer-reviewed with admin oversight`}
        backHref="/admin"
      />

      {submissions.length === 0 ? (
        <p className="border-border text-muted rounded-[var(--radius-card)] border p-8 text-center">
          No business enquiries yet.
        </p>
      ) : (
        <div className="space-y-4">
          {submissions.map((s: Row) => (
            <div key={s.id} className="card-base p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {s.status}
                    </span>
                    <span className="bg-brand-50 text-brand-700 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {businessConnectPilotLabel(s.pilotSlug)}
                    </span>
                    <span className="bg-muted-bg text-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                      {PARTICIPANT_TYPE_LABELS[s.participantType] ?? s.participantType}
                    </span>
                    <span className="text-muted text-xs">
                      {format(new Date(s.createdAt), 'MMM d, yyyy · h:mm a')}
                    </span>
                  </div>
                  <p className="text-foreground mt-2 text-lg font-semibold">{s.companyName}</p>
                  <p className="text-muted text-sm">
                    {s.city}, {s.country} · {s.industry}
                  </p>
                </div>

                <span className="bg-muted-bg text-muted inline-flex max-w-xs items-center rounded-full px-2.5 py-1 text-[11px] font-medium">
                  Oversight view only · organizer-led review
                </span>
              </div>

              {/* Summary line */}
              <div className="text-muted mt-3 grid grid-cols-1 gap-2 text-sm leading-relaxed sm:grid-cols-2">
                <p>
                  <span className="text-foreground font-medium">Looking for:</span>{' '}
                  {labelList(s.lookingFor, LOOKING_FOR_LABELS)}
                  {s.lookingForOther ? ` (${s.lookingForOther})` : ''}
                </p>
                <p>
                  <span className="text-foreground font-medium">Offering:</span>{' '}
                  {labelList(s.offering, OFFERING_LABELS)}
                  {s.offeringOther ? ` (${s.offeringOther})` : ''}
                </p>
                <p>
                  <span className="text-foreground font-medium">Attending:</span>{' '}
                  {YES_NO_NOT_SURE_LABELS[s.attendingEvent] ?? s.attendingEvent}
                </p>
                <p>
                  <span className="text-foreground font-medium">Member:</span>{' '}
                  {YES_NO_NOT_SURE_LABELS[s.isPartnerMember] ?? s.isPartnerMember}
                </p>
                <p>
                  <span className="text-foreground font-medium">Contact:</span> {s.contactName} ·{' '}
                  <a href={`mailto:${s.contactEmail}`} className="text-brand-700 hover:underline">
                    {s.contactEmail}
                  </a>
                </p>
              </div>

              {/* Full details */}
              <details className="mt-3">
                <summary className="text-brand-700 cursor-pointer text-sm font-medium">
                  View full enquiry
                </summary>
                <div className="text-muted mt-3 space-y-2 text-sm">
                  <p>
                    <span className="text-foreground font-medium">Business description:</span>{' '}
                    {s.businessDescription}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Specific ask:</span>{' '}
                    {s.specificAsk}
                  </p>
                  {s.website && (
                    <p>
                      <span className="text-foreground font-medium">Website:</span> {s.website}
                    </p>
                  )}
                  {s.linkedinUrl && (
                    <p>
                      <span className="text-foreground font-medium">LinkedIn:</span> {s.linkedinUrl}
                    </p>
                  )}
                  {s.phone && (
                    <p>
                      <span className="text-foreground font-medium">Phone / WhatsApp:</span>{' '}
                      {s.phone}
                    </p>
                  )}
                  {s.preferredGeography && (
                    <p>
                      <span className="text-foreground font-medium">Preferred geography:</span>{' '}
                      {s.preferredGeography}
                    </p>
                  )}
                  {s.referredBy && (
                    <p>
                      <span className="text-foreground font-medium">Referred by:</span>{' '}
                      {s.referredBy}
                    </p>
                  )}
                  {s.associatedChapterOrOrg && (
                    <p>
                      <span className="text-foreground font-medium">Chapter / org:</span>{' '}
                      {s.associatedChapterOrOrg}
                    </p>
                  )}
                  <p className="text-xs">
                    Consent — review: {s.consentToReview ? 'yes' : 'no'} · manual-intro
                    understanding: {s.consentManualIntroUnderstanding ? 'yes' : 'no'} · share
                    selected info: {s.consentToShareSelectedInfo ? 'yes' : 'no'} · notice version:{' '}
                    {s.consentPolicyVersion}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
                      Organizer Notes
                    </p>
                    <p className="border-border text-muted mt-1 rounded-[var(--radius-button)] border bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {s.adminNotes?.trim() || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
                      Match Notes
                    </p>
                    <p className="border-border text-muted mt-1 rounded-[var(--radius-button)] border bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {s.matchNotes?.trim() || '—'}
                    </p>
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
