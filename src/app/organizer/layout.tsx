import Link from 'next/link';
import { getSessionUser } from '@/lib/session';

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/organizer" className="text-base font-bold text-indigo-700">
              Organizer Dashboard
            </Link>
            {user && (
              <nav className="hidden items-center gap-4 text-sm sm:flex">
                <Link href="/organizer" className="text-gray-600 hover:text-gray-900">
                  Overview
                </Link>
                <Link href="/organizer/edit" className="text-gray-600 hover:text-gray-900">
                  Edit Profile
                </Link>
                <Link href="/organizer/channels" className="text-gray-600 hover:text-gray-900">
                  Channels
                </Link>
                <Link href="/organizer/events/new" className="text-gray-600 hover:text-gray-900">
                  Add Event
                </Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-500">{user.email}</span>
                <form action="/organizer/logout" method="POST">
                  <button type="submit" className="text-sm text-red-500 hover:text-red-700">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/organizer/login" className="text-sm text-indigo-600 hover:underline">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
