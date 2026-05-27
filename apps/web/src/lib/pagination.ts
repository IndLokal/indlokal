import type { OffsetPaginationMeta } from '@indlokal/shared';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function firstParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type ParsePaginationOptions = {
  pageParam?: string;
  pageSizeParam?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
};

export function parseOffsetPagination(
  searchParams: Record<string, string | string[] | undefined>,
  options: ParsePaginationOptions = {},
): { page: number; pageSize: number; skip: number; take: number } {
  const pageParam = options.pageParam ?? 'page';
  const pageSizeParam = options.pageSizeParam ?? 'pageSize';
  const defaultPageSize = clamp(options.defaultPageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const maxPageSize = Math.max(1, options.maxPageSize ?? MAX_PAGE_SIZE);

  const page = parsePositiveInt(firstParamValue(searchParams[pageParam])) ?? DEFAULT_PAGE;
  const rawPageSize = parsePositiveInt(firstParamValue(searchParams[pageSizeParam]));
  const pageSize = rawPageSize ? clamp(rawPageSize, 1, maxPageSize) : defaultPageSize;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildOffsetPaginationMeta(args: {
  page: number;
  pageSize: number;
  totalCount?: number;
  itemCount: number;
}): OffsetPaginationMeta {
  const { page, pageSize, totalCount, itemCount } = args;

  if (totalCount !== undefined) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const hasPreviousPage = page > 1;
    const hasNextPage = page < totalPages;

    if (totalCount === 0 || itemCount === 0) {
      return {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasPreviousPage,
        hasNextPage,
        from: 0,
        to: 0,
      };
    }

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(from + itemCount - 1, totalCount);

    return {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage,
      hasNextPage,
      from,
      to,
    };
  }

  const hasPreviousPage = page > 1;
  const hasNextPage = itemCount === pageSize;
  const from = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = itemCount === 0 ? 0 : from + itemCount - 1;

  return {
    page,
    pageSize,
    hasPreviousPage,
    hasNextPage,
    from,
    to,
  };
}

export function buildPageHref(args: {
  searchParams: Record<string, string | string[] | undefined>;
  pageParam?: string;
  page: number;
  resetParams?: string[];
}): string {
  const pageParam = args.pageParam ?? 'page';
  const params = new URLSearchParams();

  for (const [key, raw] of Object.entries(args.searchParams)) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (value !== undefined && value !== '') params.append(key, value);
      }
      continue;
    }
    if (raw !== '') params.set(key, raw);
  }

  if (args.resetParams) {
    for (const key of args.resetParams) params.delete(key);
  }

  params.set(pageParam, String(Math.max(1, args.page)));

  const query = params.toString();
  return query ? `?${query}` : '?';
}
