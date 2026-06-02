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

export default function AdminDashboardPage() {
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
          },
          {
            title: 'Claims',
            description: 'Review ownership claim requests',
            href: '/admin/claims',
          },
          {
            title: 'Organizer Access',
            description: 'Manage organizers and collaborators by community',
            href: '/admin/collaborators',
          },
          {
            title: 'Reports',
            description: 'User reports and feedback requiring moderation',
            href: '/admin/reports',
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
  links,
}: {
  title: string;
  description: string;
  href: string;
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="border-border rounded-[var(--radius-card)] border p-6 transition-colors hover:bg-[var(--color-muted-bg)]">
      <Link href={href} className="block">
        <h2 className="font-semibold">{title}</h2>
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
