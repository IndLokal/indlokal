'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Events, useTrackEvent } from '@/lib/analytics';
import { toggleFollowCommunity } from '@/app/actions/saves';

type Props = {
  communityId: string;
  following: boolean;
};

export function CommunityFollowButton({ communityId, following }: Props) {
  const router = useRouter();
  const track = useTrackEvent();
  const [isPending, startTransition] = useTransition();
  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic(following);

  function handleClick() {
    startTransition(async () => {
      setOptimisticFollowing(!optimisticFollowing);
      const result = await toggleFollowCommunity(communityId);
      if ('requiresAuth' in result) {
        router.push('/me/login');
        return;
      }
      if ('saved' in result) {
        track(result.saved ? Events.COMMUNITY_FOLLOWED : Events.COMMUNITY_UNFOLLOWED, {
          community_id: communityId,
        });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={optimisticFollowing}
      className={`rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold transition-colors ${
        optimisticFollowing
          ? 'bg-brand-700 hover:bg-brand-800 text-white'
          : 'bg-brand-600 hover:bg-brand-700 text-white'
      }`}
    >
      {optimisticFollowing ? 'Following' : 'Follow'}
    </button>
  );
}
