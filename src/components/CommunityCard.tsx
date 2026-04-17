import Link from 'next/link';
import type { CommunityListItem } from '@/modules/community/types';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ActivityBadge } from '@/components/ui';

type Props = {
  community: CommunityListItem;
  city: string;
  savedByUser?: boolean;
};

const AVATAR_COLORS = [
  'from-brand-500 to-brand-700',
  'from-violet-500 to-purple-700',
  'from-fuchsia-500 to-pink-700',
  'from-orange-500 to-red-600',
  'from-emerald-500 to-teal-700',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CommunityCard({ community, city, savedByUser }: Props) {
  const href = `/${city}/communities/${community.slug}`;
  const avatarGradient = getAvatarColor(community.name);

  return (
    <div className="group hover:shadow-brand-500/10 relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 shadow-black/5 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      {/* Colored top stripe — 3px gradient */}
      <div className={`h-1 w-full bg-gradient-to-r ${avatarGradient}`} />

      <Link href={href} className="flex flex-col p-5">
        {/* Top row: logo + badges */}
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${avatarGradient} text-xl font-bold text-white shadow-lg`}
          >
            {community.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.logoUrl}
                alt={community.name}
                className="h-full w-full object-cover"
              />
            ) : (
              community.name.charAt(0)
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {community.isTrending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                🔥 Trending
              </span>
            )}
            {community.claimState === 'CLAIMED' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
                ✓ Verified
              </span>
            )}
            <ActivityBadge score={community.activityScore ?? 0} />
          </div>
        </div>

        {/* Name */}
        <h3 className="text-foreground group-hover:text-brand-600 mt-4 leading-snug font-bold transition-colors">
          {community.name}
        </h3>

        {/* Description */}
        {community.description && (
          <p className="text-muted mt-1.5 line-clamp-2 text-sm">{community.description}</p>
        )}

        {/* Category tags */}
        {community.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {community.categories.slice(0, 3).map(({ category }) => (
              <span
                key={category.slug}
                className="bg-muted-bg text-foreground/70 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {category.icon && <span>{category.icon}</span>}
                {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer: event count */}
        <div className="border-border/30 mt-5 mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <div className="text-muted flex items-center gap-3 text-xs font-semibold">
            {community._count.events > 0 && (
              <span className="bg-brand-50 text-brand-600 flex items-center gap-1.5 rounded-full px-3 py-1">
                <span className="bg-brand-500 h-1.5 w-1.5 animate-pulse rounded-full" />
                {community._count.events} Upcoming Event{community._count.events !== 1 ? 's' : ''}
              </span>
            )}
            {community.memberCountApprox && community._count.events === 0 && (
              <span>~{community.memberCountApprox.toLocaleString()} members</span>
            )}
          </div>
        </div>
      </Link>

      {savedByUser !== undefined && (
        <div className="absolute right-3 bottom-4 z-10">
          <BookmarkButton communityId={community.id} saved={savedByUser} />
        </div>
      )}
    </div>
  );
}
