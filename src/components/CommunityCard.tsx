import Link from 'next/link';
import type { CommunityListItem } from '@/modules/community/types';

type Props = {
  community: CommunityListItem;
  city: string;
};

function ActivityBadge({ score }: { score: number }) {
  const level =
    score >= 80
      ? { label: 'Very Active', cls: 'bg-green-100 text-green-700' }
      : score >= 60
        ? { label: 'Active', cls: 'bg-blue-100 text-blue-700' }
        : score >= 40
          ? { label: 'Moderate', cls: 'bg-yellow-100 text-yellow-700' }
          : { label: 'Low', cls: 'bg-gray-100 text-gray-500' };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${level.cls}`}
    >
      {level.label}
    </span>
  );
}

export function CommunityCard({ community, city }: Props) {
  const href = `/${city}/communities/${community.slug}`;

  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Top row: logo + activity badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
          {community.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.logoUrl}
              alt={community.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            community.name.charAt(0)
          )}
        </div>
        <ActivityBadge score={community.activityScore ?? 0} />
      </div>

      {/* Name */}
      <h3 className="mt-3 leading-snug font-semibold text-gray-900">{community.name}</h3>

      {/* Description */}
      {community.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{community.description}</p>
      )}

      {/* Category tags */}
      {community.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {community.categories.slice(0, 3).map(({ category }) => (
            <span
              key={category.slug}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {category.icon && <span>{category.icon}</span>}
              {category.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: member count + event count */}
      <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-gray-400">
        {community.memberCountApprox && (
          <span>~{community.memberCountApprox.toLocaleString()} members</span>
        )}
        {community._count.events > 0 && (
          <span>
            {community._count.events} event{community._count.events !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}
