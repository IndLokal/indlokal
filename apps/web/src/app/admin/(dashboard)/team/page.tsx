import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth/permissions';
import { grantRole, revokeRole } from './actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';

export const metadata = { title: 'Team - Admin' };

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  PARTNERSHIPS_LEAD: 'Partnerships Lead',
  OPS_LEAD: 'Ops Lead',
  CITY_AMBASSADOR: 'City Ambassador',
  CONTENT_EDITOR: 'Content Editor',
  COMMUNITY_ADMIN: 'Community Admin',
  EVENT_HOST: 'Event Host',
  PARTNER_ORG_ADMIN: 'Partner Org Admin',
  USER: 'User',
};

const ROLE_BADGE: Record<string, string> = {
  PLATFORM_ADMIN: 'bg-red-100 text-red-700',
  PARTNERSHIPS_LEAD: 'bg-purple-100 text-purple-700',
  OPS_LEAD: 'bg-orange-100 text-orange-700',
  CITY_AMBASSADOR: 'bg-sky-100 text-sky-700',
  CONTENT_EDITOR: 'bg-teal-100 text-teal-700',
  COMMUNITY_ADMIN: 'bg-green-100 text-green-700',
  EVENT_HOST: 'bg-lime-100 text-lime-700',
  PARTNER_ORG_ADMIN: 'bg-indigo-100 text-indigo-700',
  USER: 'bg-gray-100 text-gray-600',
};

export default async function AdminTeamPage() {
  // Only PLATFORM_ADMIN can access this page (team.read → team.grant/revoke)
  const viewer = await requireCan('team.read');

  const [assignments, cities] = await Promise.all([
    db.roleAssignment.findMany({
      where: { revokedAt: null },
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: { grantedAt: 'desc' },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const canGrant = viewer.role === 'PLATFORM_ADMIN';

  return (
    <AdminPage>
      <AdminPageHeader
        title="Team & Role Assignments"
        description={`${assignments.length} active assignment${assignments.length !== 1 ? 's' : ''}`}
        backHref="/admin"
      />

      {/* ── Grant form (PLATFORM_ADMIN only) ── */}
      {canGrant && (
        <section className="border-border mt-8 rounded-[var(--radius-card)] border p-6">
          <h2 className="mb-4 font-semibold">Grant a role</h2>
          <form action={grantRole} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">User email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="border-border w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">Role</label>
              <select
                name="role"
                required
                className="border-border w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {Object.entries(ROLE_LABELS)
                  .filter(([k]) => k !== 'USER')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs font-medium">
                City scope <span className="font-normal">(ambassadors)</span>
              </label>
              <select
                name="cityId"
                className="border-border w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">- None -</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="bg-brand-600 hover:bg-brand-700 w-full rounded px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Grant
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Active assignments table ── */}
      <section className="mt-8">
        <h2 className="mb-4 font-semibold">Active assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-muted text-sm">No role assignments yet.</p>
        ) : (
          <AdminTableWrap>
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>User</AdminTh>
                  <AdminTh>Role</AdminTh>
                  <AdminTh>City scope</AdminTh>
                  <AdminTh>Granted</AdminTh>
                  {canGrant && <AdminTh>Actions</AdminTh>}
                </tr>
              </AdminTableHead>
              <tbody className="divide-border divide-y">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted-bg/50 transition-colors">
                    <td className="px-4 py-2">
                      <span className="font-medium">{a.user.displayName ?? a.user.email}</span>
                      {a.user.displayName && (
                        <span className="text-muted ml-2 text-xs">{a.user.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[a.role] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {ROLE_LABELS[a.role] ?? a.role}
                      </span>
                    </td>
                    <td className="text-muted px-4 py-2 text-xs">{a.cityId ?? '-'}</td>
                    <td className="text-muted px-4 py-2 text-xs">
                      {new Date(a.grantedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {canGrant && (
                      <td className="px-4 py-2">
                        <form action={revokeRole}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:text-red-700 hover:underline"
                          >
                            Revoke
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </AdminTableWrap>
        )}
      </section>
    </AdminPage>
  );
}
