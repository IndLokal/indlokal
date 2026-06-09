import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { startOfISOWeek, subWeeks } from 'date-fns';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminStatRow } from '@/components/admin/stat-row';
import { Badge } from '@/components/ui';

export const metadata = { title: 'My Score - Ambassador' };

export default async function AmbassadorMePage() {
  const user = await requireCan('ambassador.read');

  // Use ISO week boundaries (Monday 00:00 UTC) so "this week" and "last week"
  // match the "resets every Monday" copy shown in the UI.
  const thisWeekStart = startOfISOWeek(new Date());
  const prevWeekStart = subWeeks(thisWeekStart, 1);

  const [
    submissionsThisWeek,
    submissionsAllTime,
    submissionsLastWeek,
    checkInsThisWeek,
    checkInsAllTime,
    checkInsLastWeek,
    feedbackThisWeek,
    feedbackAllTime,
  ] = await Promise.all([
    db.pipelineItem.count({ where: { submittedBy: user.id, createdAt: { gte: thisWeekStart } } }),
    db.pipelineItem.count({ where: { submittedBy: user.id } }),
    db.pipelineItem.count({
      where: { submittedBy: user.id, createdAt: { gte: prevWeekStart, lt: thisWeekStart } },
    }),
    db.activitySignal.count({
      where: {
        createdBy: user.id,
        signalType: 'EVENT_VERIFIED_ATTENDED',
        occurredAt: { gte: thisWeekStart },
      },
    }),
    db.activitySignal.count({
      where: { createdBy: user.id, signalType: 'EVENT_VERIFIED_ATTENDED' },
    }),
    db.activitySignal.count({
      where: {
        createdBy: user.id,
        signalType: 'EVENT_VERIFIED_ATTENDED',
        occurredAt: { gte: prevWeekStart, lt: thisWeekStart },
      },
    }),
    // Feedback: query by reporterUserId when available, fall back to email
    // (existing rows written before this migration may only have reporterEmail)
    db.contentReport.count({
      where: {
        OR: [{ reporterUserId: user.id }, { reporterEmail: user.email }],
        createdAt: { gte: thisWeekStart },
      },
    }),
    db.contentReport.count({
      where: {
        OR: [{ reporterUserId: user.id }, { reporterEmail: user.email }],
      },
    }),
  ]);

  const totalThisWeek = submissionsThisWeek + checkInsThisWeek + feedbackThisWeek;
  const totalLastWeek = submissionsLastWeek + checkInsLastWeek; // feedbackLastWeek not tracked - omit for parity
  const wowChange =
    totalLastWeek > 0 ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100) : null;

  return (
    <AdminPage>
      <div className="max-w-2xl">
        <AdminPageHeader
          title="My Scoreboard"
          description="Your contribution stats as a City Ambassador."
        />

        {/* WoW trend card */}
        <div className="border-border mb-8 rounded-[var(--radius-card)] border bg-white p-5">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
                This week
              </p>
              <p className="mt-1 text-3xl font-bold">{totalThisWeek} actions</p>
            </div>
            {wowChange !== null && (
              <Badge
                variant={wowChange >= 0 ? 'success' : 'danger'}
                className="ml-auto px-2.5 py-1 text-sm font-semibold"
              >
                {wowChange >= 0 ? `+${wowChange}%` : `${wowChange}%`} vs last week
              </Badge>
            )}
          </div>
        </div>

        {/* Stats table */}
        <div className="border-border overflow-hidden rounded-[var(--radius-card)] border bg-white">
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
              Action
            </span>
            <div className="flex gap-8">
              <span className="text-muted w-14 text-right text-[11px] font-semibold tracking-[0.08em] uppercase">
                This wk
              </span>
              <span className="text-muted w-14 text-right text-[11px] font-semibold tracking-[0.08em] uppercase">
                All time
              </span>
            </div>
          </div>
          <div className="divide-border divide-y px-4">
            <AdminStatRow
              label="Communities submitted"
              primaryValue={submissionsThisWeek}
              secondaryValue={submissionsAllTime}
            />
            <AdminStatRow
              label="Events checked in"
              primaryValue={checkInsThisWeek}
              secondaryValue={checkInsAllTime}
            />
            <AdminStatRow
              label="Feedback reports"
              primaryValue={feedbackThisWeek}
              secondaryValue={feedbackAllTime}
            />
          </div>
          <div className="border-border bg-muted-bg flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm font-semibold">Total</span>
            <div className="flex gap-8">
              <span className="w-14 text-right text-sm font-bold">{totalThisWeek}</span>
              <span className="text-muted w-14 text-right text-sm">
                {submissionsAllTime + checkInsAllTime + feedbackAllTime}
              </span>
            </div>
          </div>
        </div>

        <p className="text-muted mt-6 text-center text-xs">
          Stats refresh in real time. Week resets every Monday.
        </p>
      </div>
    </AdminPage>
  );
}
