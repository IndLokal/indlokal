/**
 * Admin Dashboard - internal content management.
 *
 * Route: /admin/
 *
 * For the founding team to seed, edit, and curate content.
 * Not public-facing in MVP.
 */
import Link from 'next/link';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { getAdminPendingCounts } from '@/lib/admin/pending-counts';

function getCardBadgeClassName(count: number): string {
  if (count === 0) {
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  if (count >= 10) {
    return 'bg-red-100 text-red-700 ring-red-200';
  }
  return 'bg-amber-100 text-amber-800 ring-amber-200';
}

function getQueueCardClassName(pendingCount: number | undefined): string {
  if (pendingCount === undefined) {
    return 'border-border bg-white';
  }
  if (pendingCount === 0) {
    return 'border-slate-200 bg-gradient-to-b from-white to-slate-50/70';
  }
  if (pendingCount >= 10) {
    return 'border-red-200 bg-gradient-to-b from-white to-red-50/70';
  }
  return 'border-amber-200 bg-gradient-to-b from-white to-amber-50/70';
}

export default async function AdminDashboardPage() {
  const pendingCounts = await getAdminPendingCounts();

  return (
    <AdminPage>
      <AdminPageHeader title="Admin Dashboard" description="Content management for IndLokal." />

      <DashboardSection
        title="Data and Automation"
        description="Catalog quality, ingestion, and ranking"
        cards={[
          {
            title: 'Data Management',
            description: 'Cities, categories, communities, events, resources, and import tools',
            href: '/admin/data',
            links: [
              { label: 'Communities', href: '/admin/data/communities' },
              { label: 'Events', href: '/admin/data/events' },
              { label: 'Resources', href: '/admin/data/resources' },
            ],
          },
          {
            title: 'Automation Ops',
            description: 'Pipeline review, scoring refresh, and merge operations',
            href: '/admin/pipeline',
            pendingCount: pendingCounts.pipeline,
            links: [
              { label: 'Scoring', href: '/admin/scoring' },
              { label: 'Merge Communities', href: '/admin/merge' },
            ],
          },
        ]}
      />

      <DashboardSection
        title="Review Queues"
        description="Daily moderation and approval work"
        cards={[
          {
            title: 'Submissions',
            description: 'Primary moderation queue for new community entries',
            href: '/admin/submissions',
            pendingCount: pendingCounts.submissions,
          },
          {
            title: 'Claims',
            description: 'Review ownership claim requests',
            href: '/admin/claims',
            pendingCount: pendingCounts.claims,
          },
          {
            title: 'Events',
            description: 'Review host/public event submissions before publishing',
            href: '/admin/events',
            pendingCount: pendingCounts.events,
          },
          {
            title: 'Organizer Access',
            description: 'Manage organizers and collaborators by community',
            href: '/admin/collaborators',
            pendingCount: pendingCounts.collaboratorRequests,
          },
          {
            title: 'Reports',
            description: 'User reports and feedback requiring moderation',
            href: '/admin/reports',
            pendingCount: pendingCounts.reports,
          },
        ]}
      />

      <DashboardSection
        title="Growth Operations"
        description="City ecosystem expansion and local operator health"
        cards={[
          {
            title: 'Outreach CRM',
            description: 'Lead pipeline for community onboarding across cities',
            href: '/admin/outreach',
          },
          {
            title: 'Analytics',
            description: 'Product signal readouts, starting with business intent',
            href: '/admin/analytics',
          },
          {
            title: 'People & Roles',
            description: 'Team permissions and ambassador performance in one place',
            href: '/admin/team',
            links: [{ label: 'Ambassador Stats', href: '/admin/ambassadors' }],
          },
        ]}
      />

      <DashboardSection
        title="Governance"
        description="Team access control and traceability"
        cards={[
          {
            title: 'Audit Log',
            description: 'Who changed what, when - full write history across all entities',
            href: '/admin/audit',
          },
        ]}
      />
    </AdminPage>
  );
}

function DashboardSection({
  title,
  description,
  cards,
}: {
  title: string;
  description: string;
  cards: {
    title: string;
    description: string;
    href: string;
    pendingCount?: number;
    links?: { label: string; href: string }[];
  }[];
}) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted text-sm">{description}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <DashboardCard
            key={card.href}
            title={card.title}
            description={card.description}
            href={card.href}
            pendingCount={card.pendingCount}
            links={card.links}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardCard({
  title,
  description,
  href,
  pendingCount,
  links,
}: {
  title: string;
  description: string;
  href: string;
  pendingCount?: number;
  links?: { label: string; href: string }[];
}) {
  const badgeLabel = pendingCount === 0 ? 'Queue clear' : 'Pending review';

  return (
    <div
      className={`rounded-[var(--radius-card)] border p-6 transition-all hover:-translate-y-0.5 hover:shadow-sm ${getQueueCardClassName(pendingCount)}`}
    >
      <Link href={href} className="block">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          {pendingCount !== undefined ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getCardBadgeClassName(pendingCount)}`}
            >
              {pendingCount}
            </span>
          ) : null}
        </div>
        {pendingCount !== undefined ? (
          <p className="text-muted mt-1 text-xs font-medium">{badgeLabel}</p>
        ) : null}
        <p className="text-muted mt-1 text-sm">{description}</p>
      </Link>

      {links && links.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
