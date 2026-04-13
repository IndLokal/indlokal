import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lg font-bold">
              LocalPulse Admin
            </Link>
          </div>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to site
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
