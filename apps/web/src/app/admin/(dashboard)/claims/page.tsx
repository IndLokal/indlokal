import { db } from '@/lib/db';
import { approveClaim, rejectClaim } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

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
                  whatsappUrl?: string;
                  telegramUrl?: string;
                  socialUrl?: string;
                }
              | undefined;

            const evidenceLinks = [
              claim?.whatsappUrl && {
                label: 'WhatsApp',
                url: claim.whatsappUrl,
                color: 'bg-green-100 text-green-700 hover:bg-green-200',
              },
              claim?.telegramUrl && {
                label: 'Telegram',
                url: claim.telegramUrl,
                color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
              },
              claim?.socialUrl && {
                label: 'Website / Social',
                url: claim.socialUrl,
                color: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
              },
            ].filter(Boolean) as { label: string; url: string; color: string }[];

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
                            <p className="text-muted text-xs font-medium uppercase tracking-wide">
                              Evidence ({evidenceLinks.length}/3)
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {evidenceLinks.map((ev) => (
                                <a
                                  key={ev.label}
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
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectClaim}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </button>
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
