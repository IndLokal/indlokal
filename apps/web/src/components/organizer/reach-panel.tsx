import type { CommunityReach, HostReach } from '@/modules/analytics-readout';

/**
 * "Your reach" panel (PRD/TDD-0050) — surfaces organizer/host analytics on the
 * dashboard. Pure presentational; data is fetched by the caller.
 */
export function ReachPanel({
  reach,
  variant = 'community',
}: {
  reach: CommunityReach | HostReach;
  variant?: 'community' | 'host';
}) {
  const hasAny =
    reach.views > 0 || reach.accessClicks > 0 || reach.saves > 0 || reach.topEvents.length > 0;

  const tiles: Array<{ label: string; value: number }> = [
    { label: 'Views', value: reach.views },
    ...(variant === 'community' ? [{ label: 'Access clicks', value: reach.accessClicks }] : []),
    { label: 'Saves', value: reach.saves },
  ];

  return (
    <div className="card-base p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Your reach</h2>
        <span className="text-muted text-sm">Last {reach.sinceDays} days</span>
      </div>

      {!hasAny ? (
        <p className="text-muted mt-3 text-sm">
          No activity yet. As people view your page, click your links, and save your events, the
          numbers will show up here.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="bg-muted-bg rounded-[var(--radius-card)] p-4">
                <p className="text-foreground text-2xl font-bold">{t.value.toLocaleString()}</p>
                <p className="text-muted text-xs">{t.label}</p>
              </div>
            ))}
          </div>

          {reach.topEvents.length > 0 && (
            <div className="mt-5">
              <h3 className="text-foreground text-sm font-semibold">Top events</h3>
              <ul className="mt-2 space-y-1.5">
                {reach.topEvents.map((e) => (
                  <li
                    key={e.eventId}
                    className="text-foreground flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-3">{e.title}</span>
                    <span className="text-muted shrink-0 text-xs">
                      {e.views.toLocaleString()} views · {e.saves.toLocaleString()} saves
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
