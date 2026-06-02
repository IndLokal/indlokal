import { db } from '@/lib/db';
import { approveSubmission, rejectSubmission } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ApproveSubmissionForm } from './ApproveSubmissionForm';
import { ConfirmSubmitButton } from '@/components/ui';

export const metadata = { title: 'Review Submissions - Admin' };

export default async function AdminSubmissionsPage() {
  // Only show genuine user submissions awaiting first-touch review.
  // - AI-pipeline imports have their own queue at /admin/pipeline.
  // - Editorial seed/bootstrap rows are curated and should not appear here.
  const submissions = await db.community.findMany({
    where: { status: 'UNVERIFIED', source: 'COMMUNITY_SUBMITTED' },
    include: {
      city: { select: { name: true } },
      categories: { include: { category: true } },
      accessChannels: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  type SubmissionRow = (typeof submissions)[number];
  type SubmissionCategoryRow = SubmissionRow['categories'][number];
  type SubmissionChannelRow = SubmissionRow['accessChannels'][number];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Community Submissions"
        description={`${submissions.length} pending review`}
        backHref="/admin"
      />

      {submissions.length === 0 ? (
        <p className="text-muted mt-12 text-center">No submissions to review.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {submissions.map((c: SubmissionRow) => {
            const meta = c.metadata as Record<string, unknown> | null;
            const submitter = meta?.submitter as
              | {
                  name?: string;
                  email?: string;
                  submittedAt?: string;
                  relationship?: 'HELP_RUN' | 'JUST_ADDING';
                  ownershipIntent?: boolean;
                }
              | undefined;
            // PRD/TDD-0036: ownership default follows the declared relationship
            // (older submissions only carry the legacy ownershipIntent flag).
            const helpsRun =
              submitter?.relationship === 'HELP_RUN' || submitter?.ownershipIntent === true;

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
                    <p className="text-muted mt-1 text-xs">
                      Submitter relationship: {helpsRun ? 'Organizer' : 'Just sharing'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ApproveSubmissionForm
                      submissionId={c.id}
                      defaultGrantOwnership={helpsRun}
                      action={approveSubmission}
                    />
                    <form action={rejectSubmission}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmitButton
                        triggerLabel="Reject"
                        title="Reject this community submission?"
                        description="This submission will be marked inactive and removed from the review queue."
                        confirmLabel="Reject submission"
                        tone="danger"
                        triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      />
                    </form>
                  </div>
                </div>

                {c.description && (
                  <p className="text-foreground mt-3 text-sm leading-relaxed">{c.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.categories.map(({ category }: SubmissionCategoryRow) => (
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
                    {c.accessChannels.map((ch: SubmissionChannelRow) => (
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
    </AdminPage>
  );
}
