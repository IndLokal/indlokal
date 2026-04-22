'use client';

import { ErrorFallback } from '@/components/ui';

export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      {...props}
      message="An error occurred in the admin panel."
      action={{ label: 'Admin home', href: '/admin' }}
    />
  );
}
