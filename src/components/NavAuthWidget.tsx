import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import { signOut } from '@/app/actions/auth';

/**
 * Server component — renders user avatar + "My Saves" link, or a "Sign in" link.
 * Embedded in the city layout nav bar.
 */
export async function NavAuthWidget() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Link
        href="/me/login"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        Sign in
      </Link>
    );
  }

  const initial = user.displayName?.charAt(0) ?? user.email.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <Link href="/me" className="flex items-center gap-2 text-sm text-gray-700 hover:text-black">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.displayName ?? 'Avatar'}
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {initial}
          </span>
        )}
        <span className="hidden sm:inline">My Saves</span>
      </Link>

      <form action={signOut}>
        <button type="submit" className="text-xs text-gray-400 hover:text-gray-700">
          Sign out
        </button>
      </form>
    </div>
  );
}
