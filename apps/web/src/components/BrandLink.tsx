import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { LogoMark } from '@/components/Logo';

type BrandLinkProps = {
  href?: string;
  className?: string;
  markSize?: number;
  showName?: boolean;
  hideNameOnMobile?: boolean;
};

export function BrandLink({
  href = '/',
  className,
  markSize = 36,
  showName = true,
  hideNameOnMobile = false,
}: BrandLinkProps) {
  return (
    <Link
      href={href}
      className={className ?? 'flex items-center gap-2.5 transition-opacity hover:opacity-80'}
    >
      <LogoMark size={markSize} className="rounded-xl shadow-sm" />
      {showName && (
        <span
          className={
            hideNameOnMobile
              ? 'text-foreground hidden text-xl font-bold tracking-tight sm:inline-block'
              : 'text-foreground text-xl font-bold tracking-tight'
          }
        >
          {siteConfig.name}
        </span>
      )}
    </Link>
  );
}
