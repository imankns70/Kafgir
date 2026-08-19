import { defaultPageSize, maxPageSize, type PagedResult, type SortDirection } from '@kafgir/contracts'

/**
 * The single place 1-based pages become a SQL `OFFSET`.
 *
 * Every paginated service goes through here rather than computing `(page - 1) * pageSize` inline, so
 * a page-numbering mistake can only ever exist in one function instead of once per grid.
 */

export type ResolvedPaging = {
  page: number
  pageSize: number
  offset: number
  limit: number
}

/**
 * Normalises whatever the caller sent into a usable window.
 *
 * Invalid input is clamped rather than rejected: a grid asking for page 0 or a `NaN` page size is a
 * UI bug, and answering it with the first page is far better for an operator than an error toast.
 */
export function resolvePaging(page?: number | null, pageSize?: number | null): ResolvedPaging {
  const safeSize = Math.min(
    maxPageSize,
    Math.max(1, Number.isFinite(pageSize) ? Math.trunc(pageSize as number) : defaultPageSize),
  )
  const safePage = Math.max(1, Number.isFinite(page) ? Math.trunc(page as number) : 1)
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize, limit: safeSize }
}

/**
 * Wraps rows and their filtered total into the shared envelope.
 *
 * `totalPages` is at least 1 even for an empty result: "صفحه ۱ از ۰" is nonsense, and the last-page
 * button needs somewhere to go.
 */
export function pagedResult<T>(
  items: T[],
  totalItems: number,
  paging: ResolvedPaging,
): PagedResult<T> {
  const total = Math.max(0, Math.trunc(totalItems))
  return {
    items,
    page: paging.page,
    pageSize: paging.pageSize,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
  }
}

/**
 * Turns a caller's sort choice into a SQL fragment, from a whitelist.
 *
 * The map is the security boundary: a sort key that is not a known column never reaches the query,
 * so a renderer cannot smuggle SQL through the sort dropdown. `fallback` also guarantees a
 * deterministic order — without one, PostgreSQL may return rows in a different order between pages
 * and the same row can appear twice while another is never shown.
 */
export function sortClause<K extends string>(
  columns: Record<K, string>,
  key: K | null | undefined,
  direction: SortDirection | null | undefined,
  fallback: K,
  /** Appended to break ties so paging stays stable across requests. */
  tieBreaker = 'id DESC',
): string {
  const column = (key != null && key in columns) ? columns[key] : columns[fallback]
  const order = direction === 'asc' ? 'ASC' : 'DESC'
  return `${column} ${order}, ${tieBreaker}`
}
