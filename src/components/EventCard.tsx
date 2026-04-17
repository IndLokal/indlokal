import Link from 'next/link';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import type { EventListItem } from '@/modules/event/types';

type Props = {
  event: EventListItem;
  city: string;
  past?: boolean;
};

function formatEventDate(date: Date): string {
  if (isToday(date)) return `Today · ${format(date, 'h:mm a')}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, 'h:mm a')}`;
  if (isThisWeek(date)) return format(date, 'EEEE · h:mm a');
  return format(date, 'EEE, MMM d · h:mm a');
}

export function EventCard({ event, city, past = false }: Props) {
  const href = `/${city}/events/${event.slug}`;
  const dateLabel = formatEventDate(new Date(event.startsAt));

  return (
    <Link
      href={href}
      className={`group hover:shadow-brand-500/10 relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 shadow-black/5 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
        past ? 'opacity-60 grayscale-[0.2]' : ''
      }`}
    >
      {/* Date banner — more vibrant */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 ${past ? 'bg-gray-100' : 'from-brand-600 to-brand-500 bg-gradient-to-r'}`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm ${past ? 'text-muted bg-white' : 'bg-white/20 text-white'}`}
          >
            {event.categories[0]?.category.icon ?? '📅'}
          </span>
          {event.isRecurring && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${past ? 'bg-gray-200 text-gray-500' : 'bg-white/20 text-white'}`}
            >
              🔄 Recurring
            </span>
          )}
        </div>
        <span
          className={`text-xs font-bold tracking-wider uppercase ${past ? 'text-muted' : 'text-white'}`}
        >
          {dateLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Title */}
        <h3 className="text-foreground group-hover:text-brand-600 line-clamp-2 leading-snug font-bold transition-colors">
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
          {event.cost && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                event.cost.toLowerCase() === 'free'
                  ? 'bg-emerald-500 text-white'
                  : 'from-accent-500 bg-gradient-to-r to-orange-500 text-white'
              }`}
            >
              {event.cost.toLowerCase() === 'free' ? 'Free' : event.cost}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
