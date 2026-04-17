'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleSaveCommunity } from '@/app/actions/saves';

type Props = {
  communityId: string;
  saved: boolean;
};

export function BookmarkButton({ communityId, saved }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      const result = await toggleSaveCommunity(communityId);
      if ('requiresAuth' in result) {
        router.push('/me/login');
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={optimisticSaved ? 'Remove from saves' : 'Save community'}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-95 ${
        optimisticSaved
          ? 'bg-brand-100 text-brand-600'
          : 'bg-muted-bg text-muted hover:text-foreground hover:bg-slate-200'
      }`}
    >
      {/* Bookmark icon */}
      <svg
        viewBox="0 0 24 24"
        fill={optimisticSaved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
