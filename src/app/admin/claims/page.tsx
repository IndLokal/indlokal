import Link from 'next/link';
import { db } from '@/lib/db';
import { approveClaim, rejectClaim } from '../actions';

export const metadata = { title: 'Review Claims — Admin' };

export default async function AdminClaimsPage() {
  const claims = await db.community.findMany({
    where: { claimState: 'CLAIM_PENDING' },
    include: {
      city: { select: { name: true } },
      claimedBy: { select: { email: true, displayName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Claim Requests</h1>
          <p className="mt-1 text-sm text-gray-500">{claims.length} pending review</p>
        </div>
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      {claims.length === 0 ? (
        <p className="mt-12 text-center text-gray-400">No claims to review.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {claims.map((c) => {
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
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{c.name}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {c.city.name} · Slug: {c.slug}
                    </p>

                    {c.claimedBy && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm">
                        <p className="font-medium text-gray-800">
                          Claimant: {c.claimedBy.displayName ?? 'Unknown'} ({c.claimedBy.email})
                        </p>
                        {claim?.relationship && (
                          <p className="mt-1 text-gray-600">Relationship: {claim.relationship}</p>
                        )}
                        {claim?.message && (
                          <p className="mt-1 text-gray-600">Message: {claim.message}</p>
                        )}
                        {evidenceLinks.length > 0 && (
                          <div className="mt-2 border-t border-gray-200 pt-2">
                            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
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
                          <p className="mt-1 text-xs text-gray-400">
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
    </div>
  );
}
