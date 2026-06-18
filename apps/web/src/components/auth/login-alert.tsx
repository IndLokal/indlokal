import type { ReactNode } from 'react';

type LoginAlertTone = 'error' | 'warning' | 'success';

type LoginAlertProps = {
  tone: LoginAlertTone;
  children: ReactNode;
};

const TONE_STYLES: Record<LoginAlertTone, string> = {
  error:
    'bg-destructive/10 text-destructive rounded-[var(--radius-button)] px-4 py-3 text-sm font-medium',
  warning:
    'rounded-[var(--radius-button)] border border-amber-200/50 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800',
  success:
    'rounded-[var(--radius-button)] border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800',
};

export function LoginAlert({ tone, children }: LoginAlertProps) {
  return <p className={TONE_STYLES[tone]}>{children}</p>;
}
