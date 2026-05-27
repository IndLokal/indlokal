export type OffsetPaginationParams = {
  page?: number;
  pageSize?: number;
};

export type OffsetPaginationMeta = {
  page: number;
  pageSize: number;
  totalCount?: number;
  totalPages?: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  from: number;
  to: number;
};

export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type CursorPaginationMeta = {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
};
