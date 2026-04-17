'use client';

import { ErrorFallback } from '@/components/ui';

export default function CityError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      {...props}
      message="We had trouble loading this page. Please try again or go back to the homepage."
      action={{ label: 'Browse cities', href: '/' }}
    />
  );
}
