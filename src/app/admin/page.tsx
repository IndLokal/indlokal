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
      <p className="mt-2 text-gray-600">Content management for LocalPulse.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Communities"
          description="Manage community profiles"
          href="/admin/communities"
        />
        <DashboardCard title="Events" description="Manage events" href="/admin/events" />
        <DashboardCard
          title="Resources"
          description="Consular & official resources"
          href="/admin/resources"
        />
        <DashboardCard title="Cities" description="City configuration" href="/admin/cities" />
        <DashboardCard
          title="Categories"
          description="Category taxonomy"
          href="/admin/categories"
        />
        <DashboardCard title="Scoring" description="Run score refresh" href="/admin/scoring" />
        <DashboardCard
          title="Submissions"
          description="Review submitted communities"
          href="/admin/submissions"
        />
        <DashboardCard title="Claims" description="Review claim requests" href="/admin/claims" />
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
      className="block rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-400 hover:bg-gray-50"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </a>
  );
}
