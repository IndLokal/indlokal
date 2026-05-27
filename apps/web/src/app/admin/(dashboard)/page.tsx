/**
 * Admin Dashboard - internal content management.
 *
 * Route: /admin/
 *
 * For the founding team to seed, edit, and curate content.
 * Not public-facing in MVP.
 */
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export default function AdminDashboardPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Admin Dashboard" description="Content management for IndLokal." />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Data Management"
          description="Cities, categories, communities, events, bulk import, health"
          href="/admin/data"
        />
        <DashboardCard title="Scoring" description="Run score refresh" href="/admin/scoring" />
        <DashboardCard
          title="Submissions"
          description="Review submitted communities"
          href="/admin/submissions"
        />
        <DashboardCard title="Claims" description="Review claim requests" href="/admin/claims" />
        <DashboardCard
          title="Organizer Access"
          description="View organizers and collaborators by community, and review pending access"
          href="/admin/collaborators"
        />
        <DashboardCard
          title="Reports"
          description="User reports &amp; suggestions"
          href="/admin/reports"
        />
        <DashboardCard
          title="Content Pipeline"
          description="AI-extracted content review queue"
          href="/admin/pipeline"
        />
        <DashboardCard
          title="Merge Communities"
          description="Consolidate duplicates into a canonical record"
          href="/admin/merge"
        />
        <DashboardCard
          title="Team"
          description="Grant and revoke operator roles"
          href="/admin/team"
        />
        <DashboardCard
          title="Ambassadors"
          description="City ambassador throughput and check-in stats"
          href="/admin/ambassadors"
        />
        <DashboardCard
          title="Outreach CRM"
          description="Lead pipeline for community onboarding across cities"
          href="/admin/outreach"
        />
        <DashboardCard
          title="Audit Log"
          description="Who changed what, when - full write history across all entities"
          href="/admin/audit"
        />
      </div>
    </AdminPage>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="border-border hover:border-border hover:bg-muted-bg block rounded-[var(--radius-card)] border p-6 transition-colors"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="text-muted mt-1 text-sm">{description}</p>
    </a>
  );
}
