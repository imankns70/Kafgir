import { describe, expect, it } from 'vitest'
import {
  clampPage, defaultPageSize, pageGap, pageSizeOptions, pageSlice, pageWindow, rowOffsetOf, totalPageCount,
} from './admin-ui'

const rows = Array.from({ length: 37 }, (_, index) => index + 1)

describe('page size choices', () => {
  it('offers the agreed sizes and defaults to the smallest', () => {
    expect(pageSizeOptions).toEqual([10, 25, 50, 100, 500, 1000])
    expect(defaultPageSize).toBe(10)
    expect(pageSizeOptions[0]).toBe(defaultPageSize)
  })
})

describe('totalPageCount', () => {
  it('rounds a partial last page up', () => {
    expect(totalPageCount(37, 10)).toBe(4)
    expect(totalPageCount(40, 10)).toBe(4)
    expect(totalPageCount(41, 10)).toBe(5)
  })

  it('reports one page for an empty grid rather than zero', () => {
    // "صفحه 1 از 0" would be nonsense, and the last-page button needs a target.
    expect(totalPageCount(0, 10)).toBe(1)
  })

  it('never divides by zero', () => {
    expect(totalPageCount(37, 0)).toBeGreaterThan(0)
  })
})

describe('clampPage', () => {
  it('keeps a page inside the range', () => {
    expect(clampPage(3, 5)).toBe(3)
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-2, 5)).toBe(1)
    expect(clampPage(9, 5)).toBe(5)
  })

  it('lands on the last page when a filter shrinks the list under the current page', () => {
    // Sitting on page 7, then filtering down to 2 pages, must not show an empty table.
    expect(clampPage(7, 2)).toBe(2)
  })

  it('survives a non-integer or NaN page', () => {
    expect(clampPage(2.7, 5)).toBe(2)
    expect(clampPage(Number.NaN, 5)).toBe(1)
  })
})

describe('pageSlice', () => {
  it('returns the rows of the requested page', () => {
    expect(pageSlice(rows, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(pageSlice(rows, 2, 10)[0]).toBe(11)
  })

  it('returns the short final page', () => {
    expect(pageSlice(rows, 4, 10)).toEqual([31, 32, 33, 34, 35, 36, 37])
  })

  it('clamps a page past the end instead of returning nothing', () => {
    expect(pageSlice(rows, 99, 10)).toEqual([31, 32, 33, 34, 35, 36, 37])
  })

  it('handles an empty list', () => {
    expect(pageSlice([], 1, 10)).toEqual([])
    expect(pageSlice([], 5, 10)).toEqual([])
  })

  it('covers every row exactly once across all pages, for every offered size', () => {
    for (const size of pageSizeOptions) {
      const pages = totalPageCount(rows.length, size)
      const seen = Array.from({ length: pages }, (_, index) => pageSlice(rows, index + 1, size)).flat()
      expect(seen).toEqual(rows)
    }
  })

  it('fits the whole list on one page at the largest size', () => {
    expect(totalPageCount(rows.length, 1000)).toBe(1)
    expect(pageSlice(rows, 1, 1000)).toHaveLength(rows.length)
  })
})

describe('pageWindow', () => {
  it('lists every page when they all fit', () => {
    expect(pageWindow(1, 6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('always keeps the first and last page one click away', () => {
    const window = pageWindow(50, 100)
    expect(window[0]).toBe(1)
    expect(window.at(-1)).toBe(100)
  })

  it('marks elided runs with a gap on both sides when in the middle', () => {
    expect(pageWindow(50, 100)).toEqual([1, pageGap, 49, 50, 51, pageGap, 100])
  })

  it('does not open a gap next to the first page when near the start', () => {
    expect(pageWindow(2, 100)).toEqual([1, 2, 3, 4, 5, pageGap, 100])
  })

  it('does not open a gap next to the last page when near the end', () => {
    expect(pageWindow(99, 100)).toEqual([1, pageGap, 96, 97, 98, 99, 100])
  })

  it('always includes the current page', () => {
    for (const page of [1, 2, 7, 42, 99, 100]) {
      expect(pageWindow(page, 100)).toContain(page)
    }
  })

  it('keeps a constant width so the strip does not resize while paging', () => {
    const widths = new Set([1, 2, 3, 50, 98, 99, 100].map((page) => pageWindow(page, 100).length))
    expect(widths.size).toBe(1)
  })

  it('never emits a page outside the range', () => {
    for (const page of [1, 25, 100]) {
      for (const entry of pageWindow(page, 100)) {
        if (entry === pageGap) continue
        expect(entry).toBeGreaterThanOrEqual(1)
        expect(entry).toBeLessThanOrEqual(100)
      }
    }
  })

  it('handles a single empty page', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(1, 0)).toEqual([1])
  })
})

describe('row numbering', () => {
  // «ردیف» is a position in the current result. It must run 1..n across pages, never restart at 1
  // on page 2, and never expose a database id.
  const rowNumbers = (page: number, pageSize: number, rowsOnPage: number) =>
    Array.from({ length: rowsOnPage }, (_, index) => rowOffsetOf(page, pageSize) + index + 1)

  it('starts page 1 at row 1', () => {
    expect(rowOffsetOf(1, 20)).toBe(0)
    expect(rowNumbers(1, 20, 20)[0]).toBe(1)
  })

  it('ends page 1 at the page size', () => {
    expect(rowNumbers(1, 20, 20).at(-1)).toBe(20)
  })

  it('continues page 2 from where page 1 stopped', () => {
    expect(rowNumbers(2, 20, 20)[0]).toBe(21)
    expect(rowNumbers(2, 20, 20).at(-1)).toBe(40)
  })

  it('recalculates when the page size changes', () => {
    expect(rowOffsetOf(2, 10)).toBe(10)
    expect(rowOffsetOf(2, 50)).toBe(50)
    expect(rowOffsetOf(3, 25)).toBe(50)
  })

  it('numbers a partial last page with its true absolute positions', () => {
    // 32 results at 20 per page: page 2 holds 12 rows, numbered 21..32.
    expect(rowNumbers(2, 20, 12)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])
  })

  it('restarts at 1 for a new filtered result, because page resets to 1', () => {
    // A search resets the grid to page 1, so the offset follows without extra bookkeeping.
    expect(rowOffsetOf(1, 20)).toBe(0)
  })

  it('never produces a negative offset for an out-of-range page', () => {
    expect(rowOffsetOf(0, 20)).toBe(0)
    expect(rowOffsetOf(-4, 20)).toBe(0)
  })

  it('produces no numbers at all for an empty page', () => {
    expect(rowNumbers(1, 20, 0)).toEqual([])
  })

  it('is independent of row identity, so ids never leak into the column', () => {
    const rowsWithIds = [{ id: 104 }, { id: 117 }, { id: 203 }]
    expect(rowsWithIds.map((_, index) => rowOffsetOf(1, 20) + index + 1)).toEqual([1, 2, 3])
  })
})
