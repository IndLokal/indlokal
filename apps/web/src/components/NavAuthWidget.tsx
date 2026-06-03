import Link from 'next/link';
import Image from 'next/image';
import { getSessionUser } from '@/lib/session';
import { signOut } from '@/app/actions/auth';

/**
 * Server component - renders user avatar + "My Saves" link, or a "Sign in" link.
 * Embedded in the city layout nav bar.
 */
export async function NavAuthWidget() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Link
        href="/me/login"
        className="btn-secondary rounded-[var(--radius-button)] px-3 py-1.5 text-sm"
      >
        Sign in
      </Link>
    );
  }

  const initial = user.displayName?.charAt(0) ?? user.email.charAt(0).toUpperCase();
  const hasActiveAmbassadorAssignment =
    user.roleAssignments?.some((a) => a.role === 'CITY_AMBASSADOR' && !a.revokedAt) ?? false;
  const hasOrganizerMembership = (user.communityMemberships?.length ?? 0) > 0;
  const hasAdminConsoleAccess =
    user.role === 'PLATFORM_ADMIN' ||
    user.role === 'OPS_LEAD' ||
    user.role === 'PARTNERSHIPS_LEAD' ||
    user.role === 'CONTENT_EDITOR';

  // Route every signed-in persona to its primary workspace from public pages.
  const dashboardHref = hasAdminConsoleAccess
    ? '/admin'
    : user.role === 'CITY_AMBASSADOR' || hasActiveAmbassadorAssignment
      ? '/ambassador'
      : user.role === 'COMMUNITY_ADMIN' || hasOrganizerMembership
        ? '/organizer'
        : user.role === 'EVENT_HOST'
          ? '/organizer/host'
          : '/me';

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap lg:gap-2">
      <Link
        href={dashboardHref}
        className="text-muted hover:text-foreground hidden shrink-0 items-center rounded-lg px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors 2xl:inline-flex"
      >
        Dashboard
      </Link>

      <Link
        href="/me"
        className="text-muted hover:text-foreground flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors"
        aria-label="My profile and saves"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.displayName ?? 'Avatar'}
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
            fetchPriority="high"
          />
        ) : (
          <span className="bg-brand-100 text-brand-700 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
            {initial}
          </span>
        )}
        <span className="hidden 2xl:inline">My Saves</span>
      </Link>

      <form action={signOut} className="shrink-0">
        <button
          type="submit"
          aria-label="Sign out"
          className="text-muted hover:text-foreground flex items-center gap-1 rounded-lg px-2 py-2 text-xs whitespace-nowrap transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M3 4.75A2.75 2.75 0 015.75 2h5.5A2.75 2.75 0 0114 4.75V6a.75.75 0 01-1.5 0V4.75c0-.69-.56-1.25-1.25-1.25h-5.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h5.5c.69 0 1.25-.56 1.25-1.25V14a.75.75 0 011.5 0v1.25A2.75 2.75 0 0111.25 18h-5.5A2.75 2.75 0 013 15.25V4.75z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M15.22 6.97a.75.75 0 011.06 0l2.25 2.25a.75.75 0 010 1.06l-2.25 2.25a.75.75 0 01-1.06-1.06l.97-.97H8.75a.75.75 0 010-1.5h7.44l-.97-.97a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden 2xl:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
