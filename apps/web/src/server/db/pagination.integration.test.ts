import { closeDatabase, configureDatabase, resolvePaging } from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Proves the SQL shape every paginated admin grid now uses:
 *
 *   SELECT …, COUNT(*) OVER ()::int AS "totalCount" … WHERE <filters> ORDER BY <stable> LIMIT/OFFSET
 *
 * The window count is the load-bearing part. Counting in a second query invites the two `WHERE`
 * clauses to drift, which is how a filtered grid ends up reporting the whole table's total.
 *
 * A generated series stands in for a table so the assertions hold whatever the database contains.
 */

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)

let sql: ReturnType<typeof postgres>

/** The exact production shape, over `rows` synthetic rows, optionally filtered to `minId`. */
const fetchPage = async (page: number, pageSize: number, rows = 250, minId = 1) => {
  const paging = resolvePaging(page, pageSize)
  const result = await sql<{ id: number; totalCount: number }[]>`
    SELECT id, COUNT(*) OVER ()::int AS "totalCount"
    FROM generate_series(1, ${rows}) AS id
    WHERE id >= ${minId}
    ORDER BY id ASC
    LIMIT ${paging.limit} OFFSET ${paging.offset}
  `
  return { items: result, totalItems: result[0]?.totalCount ?? 0, paging }
}

integration.sequential('database-side pagination', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 3, prepare: false })
    await configureDatabase(connectionString!, 3)
  })

  afterAll(async () => {
    if (!sql) return
    await sql.end()
    await closeDatabase()
  })

  it('returns the first page from the start of the ordering', async () => {
    const { items } = await fetchPage(1, 10)
    expect(items.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('offsets the second page by exactly one page', async () => {
    const { items } = await fetchPage(2, 10)
    expect(items[0]!.id).toBe(11)
    expect(items.at(-1)!.id).toBe(20)
  })

  it('returns the short final page rather than padding it', async () => {
    // 250 rows at 40 per page leaves 10 on page 7.
    const { items } = await fetchPage(7, 40)
    expect(items).toHaveLength(10)
    expect(items.at(-1)!.id).toBe(250)
  })

  it('respects the requested page size', async () => {
    for (const size of [10, 25, 50, 100]) {
      const { items } = await fetchPage(1, size)
      expect(items).toHaveLength(size)
    }
  })

  it('reports the same total on every page', async () => {
    const totals = await Promise.all([1, 2, 13, 25].map(async (page) => (await fetchPage(page, 10)).totalItems))
    expect(new Set(totals)).toEqual(new Set([250]))
  })

  it('covers every row exactly once across all pages', async () => {
    const seen: number[] = []
    for (let page = 1; page <= 25; page += 1) {
      const { items } = await fetchPage(page, 10)
      seen.push(...items.map((row) => row.id))
    }
    expect(seen).toHaveLength(250)
    expect(new Set(seen).size).toBe(250)
  })

  it('counts only the filtered rows, not the whole set', async () => {
    // The bug this guards: a filtered grid showing "۲۵۰ رکورد" while listing 50.
    const { items, totalItems } = await fetchPage(1, 10, 250, 201)
    expect(totalItems).toBe(50)
    expect(items[0]!.id).toBe(201)
  })

  it('returns an empty page past the end instead of erroring', async () => {
    const { items, totalItems } = await fetchPage(99, 10)
    expect(items).toEqual([])
    // With no rows the window count cannot report a total; the caller keeps the one it knows.
    expect(totalItems).toBe(0)
  })

  it('never emits a negative offset for an invalid page', async () => {
    const { items } = await fetchPage(0, 10)
    expect(items[0]!.id).toBe(1)
  })

  it('orders before limiting, so page 1 holds the true first rows', async () => {
    const descending = await sql<{ id: number }[]>`
      SELECT id FROM generate_series(1, 250) AS id ORDER BY id DESC LIMIT 5 OFFSET 0
    `
    // Sorting after paging would return 1..5 reversed; sorting first returns the real top.
    expect(descending.map((row) => row.id)).toEqual([250, 249, 248, 247, 246])
  })
})
