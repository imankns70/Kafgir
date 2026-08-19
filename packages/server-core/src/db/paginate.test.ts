import { describe, expect, it } from 'vitest'
import { pagedResult, resolvePaging, sortClause } from './paginate'
import { defaultPageSize, maxPageSize } from '@kafgir/contracts'

describe('resolvePaging', () => {
  it('turns a 1-based page into a zero-based offset', () => {
    // The single conversion point. An off-by-one here shows page 2's rows under page 1's label.
    expect(resolvePaging(1, 10).offset).toBe(0)
    expect(resolvePaging(2, 10).offset).toBe(10)
    expect(resolvePaging(7, 25).offset).toBe(150)
  })

  it('passes the page size through as the SQL limit', () => {
    expect(resolvePaging(3, 50)).toMatchObject({ page: 3, pageSize: 50, limit: 50, offset: 100 })
  })

  it('clamps a page below one rather than producing a negative offset', () => {
    expect(resolvePaging(0, 10)).toMatchObject({ page: 1, offset: 0 })
    expect(resolvePaging(-9, 10)).toMatchObject({ page: 1, offset: 0 })
  })

  it('falls back to the default size for missing or unusable input', () => {
    expect(resolvePaging(1, undefined).pageSize).toBe(defaultPageSize)
    expect(resolvePaging(1, null).pageSize).toBe(defaultPageSize)
    expect(resolvePaging(1, Number.NaN).pageSize).toBe(defaultPageSize)
    expect(resolvePaging(Number.NaN, 10).page).toBe(1)
  })

  it('caps an unreasonably large page size', () => {
    // Without this a caller could ask for a million rows in one query.
    expect(resolvePaging(1, 10_000).pageSize).toBe(maxPageSize)
  })

  it('never returns a size below one, so a division can never blow up', () => {
    expect(resolvePaging(1, 0).pageSize).toBeGreaterThanOrEqual(1)
    expect(resolvePaging(1, -20).pageSize).toBeGreaterThanOrEqual(1)
  })

  it('truncates a fractional page instead of producing a fractional offset', () => {
    expect(resolvePaging(2.9, 10)).toMatchObject({ page: 2, offset: 10 })
  })
})

describe('pagedResult', () => {
  const paging = resolvePaging(2, 10)

  it('reports the totals it was given', () => {
    const result = pagedResult(['a', 'b'], 37, paging)
    expect(result).toMatchObject({ page: 2, pageSize: 10, totalItems: 37, totalPages: 4 })
    expect(result.items).toEqual(['a', 'b'])
  })

  it('rounds a partial last page up', () => {
    expect(pagedResult([], 41, resolvePaging(1, 10)).totalPages).toBe(5)
    expect(pagedResult([], 40, resolvePaging(1, 10)).totalPages).toBe(4)
  })

  it('reports one page for an empty result, never zero or NaN', () => {
    const empty = pagedResult([], 0, paging)
    expect(empty.totalPages).toBe(1)
    expect(Number.isNaN(empty.totalPages)).toBe(false)
  })

  it('ignores a negative total rather than propagating it', () => {
    expect(pagedResult([], -5, paging).totalItems).toBe(0)
  })
})

describe('sortClause', () => {
  const columns = { newest: 'o.created_at', amount: 'o.total_amount', name: 'c.preferred_name' }

  it('maps a known key to its column', () => {
    expect(sortClause(columns, 'amount', 'desc', 'newest')).toContain('o.total_amount DESC')
  })

  it('honours the direction', () => {
    expect(sortClause(columns, 'name', 'asc', 'newest')).toContain('c.preferred_name ASC')
  })

  it('falls back for an unknown key instead of emitting caller text', () => {
    // The whitelist is the security boundary: a sort dropdown must not be able to reach SQL.
    const clause = sortClause(columns, 'id; DROP TABLE orders' as never, 'desc', 'newest')
    expect(clause).toContain('o.created_at')
    expect(clause).not.toContain('DROP')
  })

  it('falls back for a null or missing key', () => {
    expect(sortClause(columns, null, null, 'newest')).toContain('o.created_at DESC')
    expect(sortClause(columns, undefined, undefined, 'newest')).toContain('o.created_at DESC')
  })

  it('always appends a tie-breaker so paging is deterministic', () => {
    // Without one, equal sort values can reorder between queries and a row appears on two pages.
    for (const key of Object.keys(columns) as Array<keyof typeof columns>) {
      expect(sortClause(columns, key, 'desc', 'newest')).toContain('id DESC')
    }
  })

  it('never emits statement separators or comments', () => {
    const clause = sortClause(columns, 'amount', 'asc', 'newest')
    expect(clause).not.toMatch(/;|--/u)
  })
})
