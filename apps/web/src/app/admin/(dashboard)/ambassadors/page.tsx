import Link from 'next/link';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { startOfISOWeek } from 'date-fns';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';

export const metadata = { title: 'Ambassadors - Admin' };

export default async function AdminAmbassadorsPage() {
  await requireCan('team.read');

  // Use ISO week start (Monday 00:00 UTC) to match ambassador scoreboard
  const weekStart = startOfISOWeek(new Date());

  // Active ambassador assignments
  const ambassadorAssignments = await db.roleAssignment.findMany({
    where: {
      role: 'CITY_AMBASSADOR',
      revokedAt: null,
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { grantedAt: 'desc' },
  });

  // Fetch throughput stats per ambassador in parallel
  const userIds = ambassadorAssignments.map((a) => a.userId);

  const [submissionsAllTime, submissionsThisWeek, checkInsAllTime, checkInsThisWeek, recentCities] =
    await Promise.all([
      db.pipelineItem.groupBy({
        by: ['submittedBy'],
        where: { submittedBy: { in: userIds } },
        _count: { id: true },
      }),
      db.pipelineItem.groupBy({
        by: ['submittedBy'],
        where: { submittedBy: { in: userIds }, createdAt: { gte: weekStart } },
        _count: { id: true },
      }),
      db.activitySignal.groupBy({
        by: ['createdBy'],
        where: { createdBy: { in: userIds }, signalType: 'EVENT_VERIFIED_ATTENDED' },
        _count: { id: true },
      }),
      db.activitySignal.groupBy({
        by: ['createdBy'],
        where: {
          createdBy: { in: userIds },
          signalType: 'EVENT_VERIFIED_ATTENDED',
          occurredAt: { gte: weekStart },
        },
        _count: { id: true },
      }),
      db.city.findMany({
        where: {
          id: { in: ambassadorAssignments.map((a) => a.cityId).filter(Boolean) as string[] },
        },
        select: { id: true, name: true },
      }),
    ]);

  // Build lookup maps
  const subAll = Object.fromEntries(submissionsAllTime.map((r) => [r.submittedBy, r._count.id]));
  const subWeek = Object.fromEntries(submissionsThisWeek.map((r) => [r.submittedBy, r._count.id]));
  const ciAll = Object.fromEntries(checkInsAllTime.map((r) => [r.createdBy!, r._count.id]));
  const ciWeek = Object.fromEntries(checkInsThisWeek.map((r) => [r.createdBy!, r._count.id]));
  const cityById = Object.fromEntries(recentCities.map((c) => [c.id, c.name]));

  return (
    <AdminPage>
      <AdminPageHeader
        title="City Ambassadors"
        description={`${ambassadorAssignments.length} active ambassador${ambassadorAssignments.length !== 1 ? 's' : ''}`}
        actions={
          <Link
            href="/admin/team"
            className="border-border rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
          >
            Manage roles →
          </Link>
        }
      />

      {ambassadorAssignments.length === 0 ? (
        <p className="text-muted text-sm">
          No active city ambassadors. Assign the CITY_AMBASSADOR role via the Team page.
        </p>
      ) : (
        <AdminTableWrap>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Ambassador</AdminTh>
                <AdminTh>City</AdminTh>
                <AdminTh className="text-right">Submissions (wk)</AdminTh>
                <AdminTh className="text-right">Submissions (all)</AdminTh>
                <AdminTh className="text-right">Check-ins (wk)</AdminTh>
                <AdminTh className="text-right">Check-ins (all)</AdminTh>
                <AdminTh>Granted</AdminTh>
              </tr>
            </AdminTableHead>
            <tbody className="divide-border divide-y">
              {ambassadorAssignments.map((a) => {
                const uid = a.userId;
                const sw = subWeek[uid] ?? 0;
                const sa = subAll[uid] ?? 0;
                const cw = ciWeek[uid] ?? 0;
                const ca = ciAll[uid] ?? 0;
                const city = a.cityId ? (cityById[a.cityId] ?? a.cityId) : '-';
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p className="font-medium">{a.user.displayName || a.user.email}</p>
                      <p className="text-muted text-xs">{a.user.email}</p>
                    </td>
                    <td className="px-4 py-2 text-sm">{city}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold ${sw > 0 ? 'text-green-600' : 'text-muted'}`}>
                        {sw}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-sm">{sa}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold ${cw > 0 ? 'text-sky-600' : 'text-muted'}`}>
                        {cw}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-sm">{ca}</td>
                    <td className="text-muted px-4 py-2 text-xs">
                      {new Date(a.grantedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </AdminTableWrap>
      )}
    </AdminPage>
  );
}
