import { db } from '@/lib/db';
import { communityOptions } from '@indlokal/shared';
import { getClaimProofReadout } from '@/lib/community-trust';
import { approveClaim, rejectClaim } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ConfirmSubmitButton } from '@/components/ui';

export const metadata = { title: 'Review Claims - Admin' };

export default async function AdminClaimsPage() {
  const claims = await db.community.findMany({
    where: { claimState: 'CLAIM_PENDING' },
    include: {
      city: { select: { name: true } },
      claimedBy: { select: { email: true, displayName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  type ClaimRow = (typeof claims)[number];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Claim Requests"
        description={`${claims.length} pending review`}
        backHref="/admin"
      />

      {claims.length === 0 ? (
        <p className="text-muted mt-12 text-center">No claims to review.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {claims.map((c: ClaimRow) => {
            const meta = c.metadata as Record<string, unknown> | null;
            const claim = meta?.claimRequest as
              | {
                  relationship?: string;
                  message?: string;
                  requestedAt?: string;
                  evidenceLinks?: { type?: string; url?: string }[];
                  whatsappUrl?: string;
                  telegramUrl?: string;
                  socialUrl?: string;
                }
              | undefined;

            const typeLabel = communityOptions.CHANNEL_TYPE_LABELS;
            const typeIcon = communityOptions.CHANNEL_TYPE_ICONS;
            const typeColor: Record<string, string> = {
              WHATSAPP: 'bg-green-100 text-green-700 hover:bg-green-200',
              TELEGRAM: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
              WEBSITE: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
              FACEBOOK: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
              INSTAGRAM: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
              EMAIL: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
              MEETUP: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
              YOUTUBE: 'bg-red-100 text-red-700 hover:bg-red-200',
              LINKEDIN: 'bg-sky-100 text-sky-700 hover:bg-sky-200',
              OTHER: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            };

            const structuredEvidence = (claim?.evidenceLinks ?? [])
              .filter((ev) => Boolean(ev?.url))
              .map((ev) => {
                const key = ev.type ?? 'OTHER';
                return {
                  label: `${typeIcon[key as keyof typeof typeIcon] ?? '🔗'} ${typeLabel[key as keyof typeof typeLabel] ?? 'Other'}`,
                  url: ev.url as string,
                  color: typeColor[key] ?? typeColor.OTHER,
                };
              });

            const legacyEvidence = [
              claim?.whatsappUrl && {
                label: 'WhatsApp',
                url: claim.whatsappUrl,
                color: typeColor.WHATSAPP,
              },
              claim?.telegramUrl && {
                label: 'Telegram',
                url: claim.telegramUrl,
                color: typeColor.TELEGRAM,
              },
              claim?.socialUrl && {
                label: `${typeIcon.OTHER} Other`,
                url: claim.socialUrl,
                color: typeColor.OTHER,
              },
            ].filter(Boolean) as { label: string; url: string; color: string }[];

            const evidenceLinks =
              structuredEvidence.length > 0 ? structuredEvidence : legacyEvidence;

            const proof = getClaimProofReadout(evidenceLinks.map((ev) => ev.url));
            const proofChipColor =
              proof?.display.tone === 'strong'
                ? 'bg-emerald-100 text-emerald-700'
                : proof?.display.tone === 'supported'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700';
            return (
              <div key={c.id} className="card-base p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{c.name}</h2>
                    <p className="text-muted mt-0.5 text-sm">
                      {c.city.name} · Slug: {c.slug}
                    </p>

                    {c.claimedBy && (
                      <div className="bg-muted-bg mt-2 rounded-[var(--radius-button)] p-3 text-sm">
                        <p className="text-foreground font-medium">
                          Claimant: {c.claimedBy.displayName ?? 'Unknown'} ({c.claimedBy.email})
                        </p>
                        {claim?.relationship && (
                          <p className="text-muted mt-1">Relationship: {claim.relationship}</p>
                        )}
                        {claim?.message && (
                          <p className="text-muted mt-1">Message: {claim.message}</p>
                        )}
                        {evidenceLinks.length > 0 && (
                          <div className="border-border mt-2 border-t pt-2">
                            <p className="text-muted text-xs font-medium tracking-wide uppercase">
                              Evidence ({evidenceLinks.length})
                            </p>
                            {proof && (
                              <span
                                title={proof.reason}
                                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${proofChipColor}`}
                              >
                                {proof.text}
                              </span>
                            )}
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {evidenceLinks.map((ev) => (
                                <a
                                  key={`${ev.label}:${ev.url}`}
                                  href={ev.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ev.color}`}
                                >
                                  {ev.label} ↗
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {claim?.requestedAt && (
                          <p className="text-muted mt-1 text-xs">
                            Requested: {new Date(claim.requestedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={approveClaim}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmitButton
                        triggerLabel="Approve"
                        title="Approve this claim request?"
                        description="This will assign organizer access for this community to the claimant."
                        confirmLabel="Approve claim"
                        tone="primary"
                        triggerClassName="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      />
                    </form>
                    <form action={rejectClaim}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmitButton
                        triggerLabel="Reject"
                        title="Reject this claim request?"
                        description="The claimant will not receive organizer access for this community."
                        confirmLabel="Reject claim"
                        tone="danger"
                        triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      />
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
