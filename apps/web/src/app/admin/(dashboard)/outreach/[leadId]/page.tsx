import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { NoteForm } from './NoteForm';
import { StageSelector } from './StageSelector';
import { PromoteButton } from './PromoteButton';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  await requireCan('outreach.read');

  const lead = await db.outreachLead.findUnique({
    where: { id: leadId },
    include: {
      city: { select: { name: true } },
      community: { select: { id: true, name: true, slug: true } },
      notes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          authorId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!lead) notFound();

  // Resolve author display names
  const authorIds = [...new Set(lead.notes.map((n) => n.authorId))];
  const authors = await db.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, displayName: true, email: true },
  });
  const authorById = Object.fromEntries(authors.map((a) => [a.id, a.displayName ?? a.email]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/admin/outreach" className="text-muted hover:text-foreground">
          Outreach CRM
        </Link>
        <span className="text-muted">/</span>
        <span className="font-medium">{lead.community?.name ?? lead.suggestedName ?? 'Lead'}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Identity */}
          <div className="border-border rounded-[var(--radius-card)] border bg-white p-5">
            <h1 className="text-xl font-bold">
              {lead.community?.name ?? lead.suggestedName ?? '-'}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {lead.city.name} · {lead.source}
            </p>
            {lead.channelHint && (
              <p className="mt-2 break-all text-sm">
                <span className="text-muted">Channel: </span>
                {lead.channelHint.startsWith('http') ? (
                  <a
                    href={lead.channelHint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 hover:underline"
                  >
                    {lead.channelHint}
                  </a>
                ) : (
                  lead.channelHint
                )}
              </p>
            )}
            {lead.community && (
              <div className="mt-3">
                <Link
                  href={`/communities/${lead.community.slug}`}
                  className="text-sm text-sky-600 hover:underline"
                >
                  View community →
                </Link>
              </div>
            )}
          </div>

          {/* Stage */}
          <div className="border-border rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">Stage</h2>
            <StageSelector leadId={lead.id} current={lead.stage} />
          </div>

          {/* Notes */}
          <div className="border-border rounded-[var(--radius-card)] border bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold">Notes ({lead.notes.length})</h2>
            <NoteForm leadId={lead.id} />
            {lead.notes.length > 0 && (
              <div className="mt-6 space-y-4">
                {lead.notes.map((note) => (
                  <div key={note.id} className="border-border border-t pt-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {authorById[note.authorId] ?? note.authorId}
                      </span>
                      <span className="text-muted text-xs">
                        {new Date(note.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="border-border rounded-[var(--radius-card)] border bg-white p-4 text-sm">
            <dl className="space-y-3">
              <div>
                <dt className="text-muted text-xs font-medium uppercase tracking-wide">Created</dt>
                <dd className="mt-0.5">
                  {new Date(lead.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-medium uppercase tracking-wide">
                  Next action
                </dt>
                <dd
                  className={`mt-0.5 ${lead.nextActionAt && new Date(lead.nextActionAt) < new Date() ? 'font-semibold text-red-600' : ''}`}
                >
                  {lead.nextActionAt
                    ? new Date(lead.nextActionAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-medium uppercase tracking-wide">Source</dt>
                <dd className="mt-0.5 capitalize">{lead.source}</dd>
              </div>
            </dl>
          </div>

          {/* Promote */}
          {!lead.communityId && (
            <div className="border-border rounded-[var(--radius-card)] border bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold">Promote to community</h3>
              <p className="text-muted mb-3 text-xs">
                Creates a new UNVERIFIED community record and links it to this lead.
              </p>
              <PromoteButton leadId={lead.id} communityId={lead.communityId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
