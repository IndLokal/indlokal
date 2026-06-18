import type { ReactNode } from 'react';
import Link from 'next/link';

type LoginSuccessProps = {
  title?: string;
  body: ReactNode;
  hint?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function LoginSuccess({
  title = 'Check your inbox',
  body,
  hint,
  backHref,
  backLabel = 'Back to login',
}: LoginSuccessProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
          ✓
        </div>
        <h2 className="text-xl font-bold tracking-tight text-emerald-900">{title}</h2>
        <p className="mt-2.5 text-sm leading-relaxed text-emerald-800">{body}</p>
        {hint ? (
          <p className="mt-6 border-t border-emerald-200/50 pt-4 text-xs font-medium text-emerald-600/70">
            {hint}
          </p>
        ) : null}
        {backHref ? (
          <div className="mt-4">
            <Link
              href={backHref}
              className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 hover:underline"
            >
              ← {backLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
