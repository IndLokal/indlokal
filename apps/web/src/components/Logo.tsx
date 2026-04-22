import type { SVGProps } from 'react';

/**
 * IndLokal Pulse mark.
 *
 * Bicolour pulse line on an indigo tile — the cream half rises from the local
 * German context on the left, the saffron half descends with Indian community
 * warmth on the right; they meet at the peak (the moment of discovery).
 *
 * See `docs/brand/DESIGN_GUIDELINES.md` §1 and `docs/brand/assets/logo-mark.svg`.
 */
export function LogoMark({
  size = 36,
  className,
  ...props
}: { size?: number | string; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="IndLokal"
      {...props}
    >
      <rect width="256" height="256" rx="56" fill="#4F46E5" />
      <g fill="none" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="40,150 100,150 128,68" stroke="#FAFAF9" />
        <polyline points="128,68 156,150 216,150" stroke="#F59E0B" />
      </g>
    </svg>
  );
}
