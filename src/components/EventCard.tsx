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
      className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        past ? 'border-gray-200 opacity-75' : 'border-gray-200'
      }`}
    >
      {/* Category icon + date */}
      <div className="flex items-center justify-between">
        <span className="text-xl">{event.categories[0]?.category.icon ?? '📅'}</span>
        <span className={`text-xs font-medium ${past ? 'text-gray-400' : 'text-indigo-600'}`}>
          {dateLabel}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-2 line-clamp-2 leading-snug font-semibold text-gray-900">{event.title}</h3>

      {/* Venue or Online */}
      {(event.venueName || event.isOnline) && (
        <p className="mt-1 truncate text-sm text-gray-500">
          {event.isOnline ? '🌐 Online' : `📍 ${event.venueName}`}
        </p>
      )}

      {/* Footer: community + cost */}
      <div className="mt-auto flex items-center justify-between pt-3 text-xs">
        {event.community ? (
          <span className="max-w-[70%] truncate text-gray-500">{event.community.name}</span>
        ) : (
          <span />
        )}
        {event.cost && (
          <span
            className={`ml-2 shrink-0 rounded-full px-2 py-0.5 font-medium ${
              event.cost === 'free'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {event.cost === 'free' ? 'Free' : event.cost}
          </span>
        )}
      </div>
    </Link>
  );
}
