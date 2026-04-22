'use client';

import { ErrorFallback } from '@/components/ui';

export default function OrganizerError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback {...props} action={{ label: 'Go to Home', href: '/' }} />;
}
