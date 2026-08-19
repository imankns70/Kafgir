import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultPageSize, pageSizeOptions, type PagedResult } from '@kafgir/contracts'
import { formatNumber } from './number-format'
import { PersianDatePicker } from './PersianDatePicker'
import { PersianTimePicker } from './PersianTimePicker'

/**
 * The shell primitives every admin screen is built from.
 *
 * These used to be private to `App.tsx`, so pages living in other files hand-rolled the same markup
 * and drifted apart. Sharing them is what keeps a new screen looking like the rest of the app.
 */

export function PageFrame({ title, description, actions, children }: {
  title: string
  /** One line under the heading explaining what the screen is for. */
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return <section className="page">
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      <div className="page-actions">{actions}</div>
    </header>
    {children}
  </section>
}

/**
 * One card for the controls that sit above a grid — create/edit fields, then search and filters.
 *
 * Rows inside are separated by a hairline instead of each getting its own panel. A single group
 * filter in a panel of its own reads as a second, mostly-empty card and pushes the grid down the
 * screen for no reason; the controls belong to the same task, so they belong in the same card.
 *
 * Pass the rows as children: a `<form className="form-grid …">` and a `<div className="toolbar">`
 * keep their existing layout classes and simply lose the card chrome.
 */
export function AdminControls({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`panel admin-controls${className ? ` ${className}` : ''}`}>{children}</section>
}

export function Message({ error, children }: { error?: string | null; children?: ReactNode }) {
  if (!error && !children) return null
  return <div className={error ? 'message error' : 'message'} role={error ? 'alert' : 'status'}>
    {error && <span>{error}</span>}
    {children}
  </div>
}

export function StatusPill({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'open' : 'closed'}`}>{active ? 'فعال' : 'غیرفعال'}</span>
}

/** Marks a row the operator may reorder or rename but not remove, because the code is wired in. */
export function SystemPill({ isSystem }: { isSystem: boolean }) {
  return <span className={`badge ${isSystem ? 'neutral' : 'open'}`}>{isSystem ? 'سیستمی' : 'سفارشی'}</span>
}

/**
 * The three states every list screen has to answer for: still loading, loaded but empty, or failed.
 * Returning `null` means the caller should render its rows.
 */
export function ListState({ loading, error, isEmpty, emptyText }: {
  loading: boolean
  error?: string | null
  isEmpty: boolean
  emptyText: string
}) {
  if (error) return null
  if (loading) return <p className="list-state" role="status">در حال دریافت…</p>
  if (isEmpty) return <p className="list-state">{emptyText}</p>
  return null
}

/**
 * The one date control in the admin: a Jalali calendar over an ISO Gregorian value.
 *
 * Every screen goes through here, so the calendar an operator sees and the `YYYY-MM-DD` the API
 * receives can never drift apart per-page.
 *
 * A `<label>` cannot wrap the picker — its trigger is a button, and clicking a label re-fires onto
 * the control, which would immediately toggle the panel shut again. The caption is therefore a
 * sibling bound with `htmlFor`.
 */
export function DateField({ label, value, onChange, allowClear }: {
  label: string
  value: string
  onChange: (value: string) => void
  allowClear?: boolean
}) {
  const id = useId()
  return <div className="field admin-date-field">
    <label htmlFor={id}>{label}</label>
    <PersianDatePicker id={id} value={value} onChange={onChange} allowClear={allowClear} />
  </div>
}

/** The time counterpart of {@link DateField}: a 24-hour picker over an `HH:MM` value. */
export function TimeField({ label, value, onChange, allowClear }: {
  label: string
  value: string
  onChange: (value: string) => void
  allowClear?: boolean
}) {
  const id = useId()
  return <div className="field admin-date-field">
    <label htmlFor={id}>{label}</label>
    <PersianTimePicker id={id} value={value} onChange={onChange} allowClear={allowClear} />
  </div>
}

export { defaultPageSize, pageSizeOptions } from '@kafgir/contracts'

export type PaginationState = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  /** Rows preceding this page, so «ردیف» counts across pages instead of restarting at 1. */
  rowOffset: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

/** Rows on earlier pages of the current result. Pages are 1-based, so page 1 offsets by nothing. */
export const rowOffsetOf = (page: number, pageSize: number) => Math.max(0, page - 1) * pageSize

/**
 * The «ردیف» heading. Presentation only: it is a position in the current result, never a database
 * id, so it is not sortable, filterable or searchable.
 */
export function RowNumberHead() {
  return <th className="row-number" scope="col">ردیف</th>
}

/** The «ردیف» cell. `offset` comes from the grid's {@link PaginationState.rowOffset}. */
export function RowNumberCell({ offset, index }: { offset: number; index: number }) {
  return <td className="row-number">{formatNumber(offset + index + 1)}</td>
}

/** Clamps a requested page into the range a list of this size actually has. */
export const clampPage = (page: number, totalPages: number) =>
  Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, totalPages))

export const totalPageCount = (totalItems: number, pageSize: number) =>
  Math.max(1, Math.ceil(Math.max(0, totalItems) / Math.max(1, pageSize)))

/** The slice of `rows` belonging to a page, guarding against a page index past the end. */
export function pageSlice<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, totalPageCount(rows.length, pageSize))
  return rows.slice((safePage - 1) * pageSize, safePage * pageSize)
}

/**
 * Client-side paging over an array already held in state.
 *
 * Most admin grids fetch their whole result set in one call, so paging here costs nothing and keeps
 * every screen consistent. Grids whose server already pages — the customer directory, social history
 * — drive {@link Pager} from their own query state instead and skip this hook.
 *
 * The returned page is always clamped: filtering a list down to fewer pages while sitting on page 7
 * must show the last page, not an empty table.
 */
export function usePagination<T>(rows: readonly T[], initialSize: number = defaultPageSize): PaginationState & { visible: T[] } {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialSize)
  const totalItems = rows.length
  const totalPages = totalPageCount(totalItems, pageSize)
  const safePage = clampPage(page, totalPages)

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    // Row 1 of the new size is the only landing spot that is meaningful for every previous position.
    setPage(1)
  }, [])

  return {
    visible: pageSlice(rows, safePage, pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    rowOffset: rowOffsetOf(safePage, pageSize),
    setPage,
    setPageSize,
  }
}

/** Delay before a typed search reaches the database. Long enough to skip intermediate keystrokes. */
const searchDebounceMs = 300

export type ServerPagedGrid<TItem, TFilters> = PaginationState & {
  items: TItem[]
  /** Alias of {@link items}, so a table body can swap between this and `usePagination` unchanged. */
  visible: TItem[]
  loading: boolean
  error: string | null
  filters: TFilters
  /** Merges filter changes and returns to page 1, because page 7 of the old result may not exist. */
  setFilters: (patch: Partial<TFilters>) => void
  /** Replaces every filter, e.g. a «پاک کردن» button. */
  resetFilters: (next?: TFilters) => void
  /** Re-runs the current query, then steps back if the page it was on no longer exists. */
  refresh: () => Promise<void>
  /** True once a fetch has completed, so an empty grid is not mistaken for a loading one. */
  loaded: boolean
  /** Whether the emptiness is caused by the operator's filters rather than an empty table. */
  filtered: boolean
  /** The raw search box value. Debounced before it reaches the server. */
  search: string
  /** Typing resets to page 1; page 7 of the previous result may not exist for the new term. */
  setSearch: (value: string) => void
}

/**
 * Server-side paging, searching and filtering for one grid.
 *
 * Owns the interactions that were previously wrong or missing on every screen:
 *
 * - **Page reset.** Any filter or search change returns to page 1. Staying on page 7 after a search
 *   that yields two pages shows an empty table over a nonsense page count.
 * - **Stale responses.** Each fetch carries a sequence number and only the newest may write state,
 *   so a slow request for «ق» cannot land after «قیمه» and replace the newer rows.
 * - **Debounce.** Search text waits {@link searchDebounceMs}; every other filter fires immediately,
 *   because a dropdown has no intermediate values worth skipping.
 * - **Mutation safety.** {@link refresh} re-queries and, if deleting the last row of the last page
 *   emptied it, steps back to a page that exists instead of leaving a blank grid.
 */
export function useServerPagedGrid<TItem, TFilters extends { search?: string | null }>(
  fetchPage: (request: TFilters & { page: number; pageSize: number }) => Promise<PagedResult<TItem>>,
  initialFilters: TFilters,
  initialSize: number = defaultPageSize,
): ServerPagedGrid<TItem, TFilters> {
  const [filters, setFiltersState] = useState<TFilters>(initialFilters)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialSize)
  const [result, setResult] = useState<PagedResult<TItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only a response newer than every other in flight may write state.
  const sequence = useRef(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  const search = filters.search ?? ''
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    if (debouncedSearch === search) return
    const timer = window.setTimeout(() => setDebouncedSearch(search), searchDebounceMs)
    return () => window.clearTimeout(timer)
  }, [search, debouncedSearch])

  // Everything except `search`, so a keystroke does not fire an undebounced request of its own.
  const filterKey = useMemo(() => {
    const { search: _ignored, ...rest } = filters as Record<string, unknown>
    return JSON.stringify(rest)
  }, [filters])

  const run = useCallback(async (target: number, size: number) => {
    const ticket = ++sequence.current
    setLoading(true)
    try {
      const response = await fetchRef.current({
        ...filters, search: debouncedSearch || null, page: target, pageSize: size,
      } as TFilters & { page: number; pageSize: number })
      if (ticket !== sequence.current) return
      setResult(response)
      setError(null)
    } catch (reason) {
      if (ticket !== sequence.current) return
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      // A superseded request must not clear the spinner the newer one turned on.
      if (ticket === sequence.current) { setLoading(false); setLoaded(true) }
    }
  }, [debouncedSearch, filters])

  useEffect(() => { void run(page, pageSize) }, [page, pageSize, debouncedSearch, filterKey])

  const setFilters = useCallback((patch: Partial<TFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }))
    setPageState(1)
  }, [])

  const resetFilters = useCallback((next?: TFilters) => {
    setFiltersState(next ?? initialFilters)
    setPageState(1)
  }, [initialFilters])

  const totalItems = result?.totalItems ?? 0
  const totalPages = result?.totalPages ?? 1

  const refresh = useCallback(async () => {
    // Deleting the final row of the final page leaves the operator on a page that no longer exists.
    const target = clampPage(page, totalPageCount(totalItems, pageSize))
    if (target !== page) setPageState(target)
    await run(target, pageSize)
  }, [page, pageSize, totalItems, run])

  const items = result?.items ?? []
  return {
    items,
    visible: items,
    page: result?.page ?? page,
    pageSize,
    totalItems,
    totalPages,
    loading,
    loaded,
    error,
    filters,
    setFilters,
    resetFilters,
    refresh,
    filtered: Object.values(filters as Record<string, unknown>)
      .some((value) => value != null && value !== '' && value !== 'all'),
    rowOffset: rowOffsetOf(result?.page ?? page, pageSize),
    search,
    setSearch: (value: string) => setFilters({ search: value } as Partial<TFilters>),
    setPage: (next: number) => setPageState(clampPage(next, totalPages)),
    setPageSize: (size: number) => { setPageSizeState(size); setPageState(1) },
  }
}

/** A gap in the page-number strip, standing for the pages that were elided. */
export const pageGap = 'gap' as const

/**
 * The page numbers to show, with `gap` markers where the run is broken.
 *
 * A grid of 1000 rows at 10 per page has 100 pages, which cannot all be buttons. The first and last
 * are always reachable so the ends stay one click away, and a window follows the current page. The
 * window keeps a constant width, so the strip does not resize as the operator pages through it.
 */
export function pageWindow(
  page: number,
  totalPages: number,
  maxButtons = 7,
): Array<number | typeof pageGap> {
  const total = Math.max(1, totalPages)
  if (total <= maxButtons) return Array.from({ length: total }, (_, index) => index + 1)

  const current = clampPage(page, total)
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index)

  // Hugging an edge needs only one gap, so the run there is two longer than the middle run. Sizing
  // the two cases separately is what keeps the strip a constant width instead of growing by one as
  // the operator pages away from the first or last page.
  const edgeRun = maxButtons - 2
  if (current <= edgeRun - 1) return [...range(1, edgeRun), pageGap, total]
  if (current >= total - (edgeRun - 2)) return [1, pageGap, ...range(total - edgeRun + 1, total)]

  const middleRun = maxButtons - 4
  const start = current - Math.floor(middleRun / 2)
  return [1, pageGap, ...range(start, start + middleRun - 1), pageGap, total]
}

/**
 * First / previous / numbered pages / next / last, plus the rows-per-page choice.
 *
 * Rendered even for a single page so the size control stays reachable; navigation simply disables.
 * Styled as the footer of the panel holding its grid, so it reads as part of the table.
 */
export function Pager({ page, pageSize, totalItems, totalPages, setPage, setPageSize, busy }: PaginationState & {
  busy?: boolean
}) {
  const atStart = page <= 1
  const atEnd = page >= totalPages
  const firstRow = totalItems === 0 ? 0 : ((page - 1) * pageSize) + 1
  const lastRow = Math.min(page * pageSize, totalItems)

  return <nav className="pager" aria-label="صفحه‌بندی">
    <div className="pager-controls">
      <button type="button" className="pager-step" disabled={busy || atStart}
        onClick={() => setPage(1)} aria-label="صفحه نخست">«</button>
      <button type="button" className="pager-step" disabled={busy || atStart}
        onClick={() => setPage(page - 1)} aria-label="صفحه قبل">‹</button>
      {pageWindow(page, totalPages).map((entry, index) => entry === pageGap
        ? <span className="pager-gap" key={`gap-${index}`} aria-hidden="true">…</span>
        : <button
            type="button"
            key={entry}
            className={`pager-number${entry === page ? ' active' : ''}`}
            disabled={busy}
            aria-label={`صفحه ${entry}`}
            aria-current={entry === page ? 'page' : undefined}
            onClick={() => setPage(entry)}
          >{entry}</button>)}
      <button type="button" className="pager-step" disabled={busy || atEnd}
        onClick={() => setPage(page + 1)} aria-label="صفحه بعد">›</button>
      <button type="button" className="pager-step" disabled={busy || atEnd}
        onClick={() => setPage(totalPages)} aria-label="صفحه آخر">»</button>
    </div>
    <div className="pager-meta">
      <span aria-live="polite">
        {totalItems === 0 ? 'موردی نیست' : `${firstRow} تا ${lastRow} از ${totalItems}`}
      </span>
      <label>
        تعداد در صفحه
        <select value={pageSize} disabled={busy}
          onChange={(event) => setPageSize(Number(event.target.value))}>
          {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
  </nav>
}

/**
 * Tracks an in-flight action so a button can disable itself and say what is happening.
 *
 * The `inFlight` ref is the load-bearing part, not the `busy` state. `setBusy(true)` does not take
 * effect until the next render, so two clicks landing in the same tick would both pass a state-based
 * check and fire the request twice. On screens that confirm a purchase, transfer money or refund a
 * payment, that is a duplicate financial record, not just a wasted request — the ref closes the
 * window synchronously.
 *
 * Errors are re-thrown so callers keep their existing `catch` and messaging; this only owns the flag.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await action()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  return { busy, run }
}
