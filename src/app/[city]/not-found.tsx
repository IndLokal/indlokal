import Link from 'next/link';

export default function CityNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-border text-6xl font-bold">404</h1>
      <h2 className="text-foreground mt-4 text-xl font-semibold">Page not found</h2>
      <p className="text-muted mt-2 max-w-md">
        We couldn&apos;t find this page. The event or community might have been removed, or the URL
        may be incorrect.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary px-5 py-2.5 text-sm">
          Browse cities
        </Link>
      </div>
    </div>
  );
}
