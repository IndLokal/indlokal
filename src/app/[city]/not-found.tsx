import Link from 'next/link';

export default function CityNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-800">Page not found</h2>
      <p className="mt-2 max-w-md text-gray-500">
        We couldn&apos;t find this page. The event or community might have been removed, or the URL
        may be incorrect.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Browse cities
        </Link>
      </div>
    </div>
  );
}
