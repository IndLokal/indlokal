import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { startOfISOWeek, subWeeks } from 'date-fns';

export const metadata = { title: 'My Score — Ambassador' };

function StatRow({
  label,
  thisWeek,
  allTime,
}: {
  label: string;
  thisWeek: number;
  allTime: number;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-8 text-sm">
        <span className="w-14 text-right font-semibold">{thisWeek}</span>
        <span className="text-muted w-14 text-right">{allTime}</span>
      </div>
    </div>
  );
}

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
  const totalLastWeek = submissionsLastWeek + checkInsLastWeek; // feedbackLastWeek not tracked — omit for parity
  const wowChange =
    totalLastWeek > 0 ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">My scoreboard</h1>
      <p className="text-muted mb-8 text-sm">Your contribution stats as a City Ambassador.</p>

      {/* WoW trend card */}
      <div className="mb-8 rounded-[var(--radius-card)] border border-sky-200 bg-sky-50 p-5">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-sky-700">This week</p>
            <p className="mt-0.5 text-3xl font-bold text-sky-900">{totalThisWeek} actions</p>
          </div>
          {wowChange !== null && (
            <span
              className={`ml-auto rounded-full px-2.5 py-1 text-sm font-semibold ${
                wowChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {wowChange >= 0 ? `+${wowChange}%` : `${wowChange}%`} vs last week
            </span>
          )}
        </div>
      </div>

      {/* Stats table */}
      <div className="border-border overflow-hidden rounded-[var(--radius-card)] border bg-white">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <span className="text-muted text-xs font-medium uppercase tracking-wide">Action</span>
          <div className="flex gap-8">
            <span className="text-muted w-14 text-right text-xs font-medium uppercase tracking-wide">
              This wk
            </span>
            <span className="text-muted w-14 text-right text-xs font-medium uppercase tracking-wide">
              All time
            </span>
          </div>
        </div>
        <div className="divide-border divide-y px-4">
          <StatRow
            label="Communities submitted"
            thisWeek={submissionsThisWeek}
            allTime={submissionsAllTime}
          />
          <StatRow
            label="Events checked in"
            thisWeek={checkInsThisWeek}
            allTime={checkInsAllTime}
          />
          <StatRow label="Feedback reports" thisWeek={feedbackThisWeek} allTime={feedbackAllTime} />
        </div>
        <div className="border-border flex items-center justify-between border-t bg-gray-50 px-4 py-3">
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
  );
}
