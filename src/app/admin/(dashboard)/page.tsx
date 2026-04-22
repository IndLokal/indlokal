/**
 * Admin Dashboard — internal content management.
 *
 * Route: /admin/
 *
 * For the founding team to seed, edit, and curate content.
 * Not public-facing in MVP.
 */
export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-muted mt-2">Content management for IndLokal.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="Scoring" description="Run score refresh" href="/admin/scoring" />
        <DashboardCard
          title="Submissions"
          description="Review submitted communities"
          href="/admin/submissions"
        />
        <DashboardCard title="Claims" description="Review claim requests" href="/admin/claims" />
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
      </div>
    </div>
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

// Admin sub-page nav shown in layout
export const ADMIN_NAV_LINKS = [
  { href: '/admin/scoring', label: 'Scoring' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/claims', label: 'Claims' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/merge', label: 'Merge' },
];
