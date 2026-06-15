import Link from 'next/link';
import type { EventListItem } from '@/modules/event/types';
import { SATELLITE_TO_METRO } from '@/lib/config';
import { formatEventCardDate } from '@/lib/datetime/event-timezone';
import { formatCostBadge } from '@indlokal/shared/content/event-pricing';

type Props = {
  event: EventListItem;
  city: string;
  past?: boolean;
  lens?: 'business';
};

export function EventCard({ event, city, past = false, lens }: Props) {
  const canonicalCity = SATELLITE_TO_METRO[city] ?? city;
  const href = `/${canonicalCity}/events/${event.slug}${lens === 'business' ? '?lens=business' : ''}`;
  const dateLabel = formatEventCardDate(new Date(event.startsAt), event.city.timezone);

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/[0.06] ${
        past ? 'opacity-60 grayscale-[0.2]' : ''
      }`}
    >
      {/* Date banner */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${past ? 'bg-gray-50' : 'from-brand-500/90 bg-gradient-to-r to-indigo-400/90'}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${past ? 'text-muted bg-white' : 'bg-white/15 text-white'}`}
          >
            {event.categories[0]?.category.icon ?? '📅'}
          </span>
          {event.isRecurring && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${past ? 'bg-gray-200 text-gray-500' : 'bg-white/15 text-white/90'}`}
            >
              🔄 Recurring
            </span>
          )}
        </div>
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase ${past ? 'text-muted' : 'text-white/90'}`}
        >
          {dateLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Title */}
        <h3 className="text-foreground group-hover:text-brand-600 line-clamp-2 text-[15px] leading-snug font-semibold transition-colors">
          {event.title}
        </h3>

        {/* Venue or Online */}
        {(event.venueName || event.isOnline) && (
          <p className="text-muted mt-2 flex items-center gap-1.5 truncate text-sm">
            {event.isOnline ? (
              <>
                <span className="text-base leading-none">🌐</span>
                <span>Online Event</span>
              </>
            ) : (
              <>
                <span className="text-destructive text-base leading-none">📍</span>
                <span>{event.venueName}</span>
              </>
            )}
          </p>
        )}

        {/* Footer: community + cost */}
        <div className="border-border/30 mt-5 mt-auto flex items-center justify-between border-t pt-4 text-sm font-medium">
          {event.community ? (
            <span className="text-muted group-hover:text-foreground max-w-[70%] truncate transition-colors">
              {event.community.name}
            </span>
          ) : (
            <span />
          )}
          {(event.costType !== 'UNCLEAR' || event.cost) && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                event.costType === 'FREE' ||
                (event.costType === 'UNCLEAR' && event.cost?.toLowerCase() === 'free')
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              }`}
            >
              {formatCostBadge(event)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
