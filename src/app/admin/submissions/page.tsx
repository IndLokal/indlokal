import Link from 'next/link';
import { db } from '@/lib/db';
import { approveSubmission, rejectSubmission } from '../actions';

export const metadata = { title: 'Review Submissions — Admin' };

export default async function AdminSubmissionsPage() {
  const submissions = await db.community.findMany({
    where: { status: 'UNVERIFIED' },
    include: {
      city: { select: { name: true } },
      categories: { include: { category: true } },
      accessChannels: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Submissions</h1>
          <p className="text-muted mt-1 text-sm">{submissions.length} pending review</p>
        </div>
        <Link href="/admin" className="text-brand-600 hover:text-brand-700 text-sm hover:underline">
          ← Dashboard
        </Link>
      </div>

      {submissions.length === 0 ? (
        <p className="text-muted mt-12 text-center">No submissions to review.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {submissions.map((c) => {
            const meta = c.metadata as Record<string, unknown> | null;
            const submitter = meta?.submitter as
              | { name?: string; email?: string; submittedAt?: string }
              | undefined;

            return (
              <div key={c.id} className="card-base p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{c.name}</h2>
                    <p className="text-muted mt-0.5 text-sm">
                      {c.city.name} · Submitted{' '}
                      {submitter?.submittedAt
                        ? new Date(submitter.submittedAt).toLocaleDateString()
                        : c.createdAt.toLocaleDateString()}
                    </p>
                    {submitter && (
                      <p className="text-muted mt-1 text-xs">
                        By {submitter.name ?? 'Unknown'}
                        {submitter.email && ` (${submitter.email})`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={approveSubmission}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectSubmission}>
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

                {c.description && (
                  <p className="text-foreground mt-3 text-sm leading-relaxed">{c.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.categories.map(({ category }) => (
                    <span
                      key={category.slug}
                      className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    >
                      {category.icon} {category.name}
                    </span>
                  ))}
                </div>

                {c.accessChannels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {c.accessChannels.map((ch) => (
                      <a
                        key={ch.id}
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-muted-bg text-muted hover:bg-muted-bg/80 inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                      >
                        {ch.channelType}
                        {ch.isPrimary && <span className="text-brand-500 ml-0.5">· primary</span>} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
