import Link from 'next/link';
import type { OffsetPaginationMeta } from '@indlokal/shared';

type PaginationControlsProps = {
  meta: OffsetPaginationMeta;
  getPageHref: (page: number) => string;
  className?: string;
};

export function PaginationControls({ meta, getPageHref, className }: PaginationControlsProps) {
  if (meta.totalPages !== undefined && meta.totalPages <= 1) {
    return (
      <div className={className}>
        <p className="text-muted text-xs">
          {meta.totalCount === 0
            ? 'No results'
            : `Showing ${meta.from}-${meta.to} of ${meta.totalCount}`}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="text-muted">
          {meta.totalCount !== undefined
            ? `Showing ${meta.from}-${meta.to} of ${meta.totalCount}`
            : `Showing ${meta.from}-${meta.to}`}
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-2">
          {meta.hasPreviousPage ? (
            <Link
              href={getPageHref(meta.page - 1)}
              className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-md border px-3 py-1.5 transition-colors"
            >
              Previous
            </Link>
          ) : (
            <span className="border-border text-muted cursor-not-allowed rounded-md border px-3 py-1.5 opacity-60">
              Previous
            </span>
          )}

          <span className="text-muted min-w-[88px] text-center" aria-current="page">
            Page {meta.page}
            {meta.totalPages ? ` of ${meta.totalPages}` : ''}
          </span>

          {meta.hasNextPage ? (
            <Link
              href={getPageHref(meta.page + 1)}
              className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-md border px-3 py-1.5 transition-colors"
            >
              Next
            </Link>
          ) : (
            <span className="border-border text-muted cursor-not-allowed rounded-md border px-3 py-1.5 opacity-60">
              Next
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}
