import Link from 'next/link';
import type { OrganizerWorkspaceRole } from '@/lib/organizer/workspace';

type OrganizerWorkspaceBannerProps = {
  communityName: string;
  cityName: string;
  role: OrganizerWorkspaceRole | null;
  showSwitchLink?: boolean;
};

export function OrganizerWorkspaceBanner({
  communityName,
  cityName,
  role,
  showSwitchLink = false,
}: OrganizerWorkspaceBannerProps) {
  return (
    <div className="border-border bg-muted-bg/60 rounded-[var(--radius-card)] border px-4 py-2.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted shrink-0 text-xs font-semibold uppercase tracking-wide">
            Active workspace
          </span>
          <span className="text-foreground truncate font-semibold">{communityName}</span>
          <span className="text-muted shrink-0">· {cityName}</span>
        </div>
        {role && (
          <span className="text-muted shrink-0 rounded-full border border-black/5 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {role === 'COMMUNITY_ADMIN' ? 'Community admin' : 'Collaborator'}
          </span>
        )}
        {showSwitchLink && (
          <Link
            href="/organizer/communities"
            className="text-brand-600 hover:text-brand-700 shrink-0 text-sm font-semibold hover:underline"
          >
            Switch community
          </Link>
        )}
      </div>
    </div>
  );
}
