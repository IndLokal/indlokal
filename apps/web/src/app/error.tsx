'use client';

import { ErrorFallback } from '@/components/ui';

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback {...props} code="500" />;
}
