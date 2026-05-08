import Link from 'next/link';
import Image from 'next/image';
import type { CommunityListItem } from '@/modules/community/types';
import { BookmarkButton } from './BookmarkButton';
import { ActivityBadge } from '@/components/ui';

type Props = {
  community: CommunityListItem;
  city: string;
  savedByUser?: boolean;
};

const AVATAR_COLORS = [
  'from-brand-400 to-brand-600',
  'from-violet-400 to-purple-600',
  'from-fuchsia-400 to-pink-600',
  'from-orange-400 to-red-500',
  'from-emerald-400 to-teal-600',
  'from-cyan-400 to-blue-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
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
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/[0.06]">
      {/* Colored top stripe */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${avatarGradient} opacity-70`} />

      <Link href={href} className="flex flex-col p-5">
        {/* Top row: logo + badges */}
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${avatarGradient} text-lg font-semibold text-white shadow-sm`}
          >
            {community.logoUrl ? (
              <Image
                src={community.logoUrl}
                alt={community.name}
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              community.name.charAt(0)
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {community.isTrending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600 ring-1 ring-orange-200">
                🔥 Trending
              </span>
            )}
            {community.claimState === 'CLAIMED' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                ✓ Verified
              </span>
            )}
            <ActivityBadge score={community.activityScore ?? 0} />
          </div>
        </div>

        {/* Name */}
        <h3 className="text-foreground group-hover:text-brand-600 mt-3 text-[15px] font-semibold leading-snug transition-colors">
          {community.name}
        </h3>

        {/* Description */}
        {community.description && (
          <p className="text-muted mt-1 line-clamp-2 text-[13px] leading-relaxed">
            {community.description}
          </p>
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
          <div className="text-muted flex items-center gap-3 text-[11px] font-medium">
            {community._count.events > 0 && (
              <span className="bg-brand-50 text-brand-600 flex items-center gap-1.5 rounded-full px-2.5 py-0.5">
                <span className="bg-brand-400 h-1.5 w-1.5 animate-pulse rounded-full" />
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
        <div className="absolute bottom-4 right-3 z-10">
          <BookmarkButton communityId={community.id} saved={savedByUser} />
        </div>
      )}
    </div>
  );
}
