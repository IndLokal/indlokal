import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-border text-6xl font-bold">404</h1>
      <h2 className="text-foreground mt-4 text-xl font-semibold">Page not found</h2>
      <p className="text-muted mt-2 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="btn-primary mt-6 px-5 py-2.5 text-sm">
        Go to homepage
      </Link>
    </div>
  );
}
