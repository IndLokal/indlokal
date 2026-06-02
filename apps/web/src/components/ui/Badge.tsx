import type { ReactNode } from 'react';

const variants = {
  // Brand
  primary: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  // Semantic
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  danger: 'bg-red-50 text-destructive ring-1 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  // Neutral
  muted: 'bg-muted-bg text-muted ring-1 ring-border/50',
  // Accent
  orange: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
} as const;

type BadgeProps = {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = 'muted', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Pulse badge driven by composite pulseScore = activityScore×0.5 + completenessScore×0.3 + trustScore×0.2
 */
export function PulseBadge({ pulseScore }: { pulseScore: number }) {
  if (pulseScore >= 80) return <Badge variant="success">Very Active</Badge>;
  if (pulseScore >= 60) return <Badge variant="info">Active</Badge>;
  if (pulseScore >= 40) return <Badge variant="warning">Moderate</Badge>;
  return <Badge variant="muted">Low activity</Badge>;
}
