import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
let sql: ReturnType<typeof postgres>

integration('PostgreSQL parity', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 5 })
    await sql`SELECT 1`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('defaults a new daily menu to closed', async () => {
    const menuDate = '2099-01-01'
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
    const rows = await sql<{ isOpen: boolean }[]>`
      INSERT INTO daily_menus (menu_date, created_at)
      VALUES (${menuDate}::date, NOW())
      RETURNING is_open AS "isOpen"
    `
    expect(rows[0]?.isOpen).toBe(false)
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
  })

  it('enforces unique daily-menu dates', async () => {
    const menuDate = '2099-01-02'
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
    await sql`INSERT INTO daily_menus (menu_date, created_at) VALUES (${menuDate}::date, NOW())`
    await expect(sql`INSERT INTO daily_menus (menu_date, created_at) VALUES (${menuDate}::date, NOW())`)
      .rejects.toMatchObject({ code: '23505' })
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
  })

  it('rolls back a failed transaction', async () => {
    const menuDate = '2099-01-03'
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
    await expect(sql.begin(async (tx) => {
      await tx`INSERT INTO daily_menus (menu_date, created_at) VALUES (${menuDate}::date, NOW())`
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    const rows = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM daily_menus WHERE menu_date = ${menuDate}::date
    `
    expect(rows[0]?.count).toBe(0)
  })

  it('serializes competing capacity reservations with a row lock', async () => {
    const suffix = crypto.randomUUID()
    const menuDate = '2099-01-04'
    await sql`DELETE FROM daily_menus WHERE menu_date = ${menuDate}::date`
    const categories = await sql<{ id: number }[]>`
      INSERT INTO food_categories
        (title, slug, display_order, is_active, created_at, updated_at)
      VALUES (${`integration-${suffix}`}, ${`integration-${suffix}`}, 999, true, NOW(), NOW())
      RETURNING id
    `
    const foods = await sql<{ id: number }[]>`
      INSERT INTO foods
        (name, slug, category_id, default_price, is_active, created_at, updated_at)
      VALUES
        (${`integration-${suffix}`}, ${`integration-${suffix}`},
         ${categories[0]!.id}, 100, true, NOW(), NOW())
      RETURNING id
    `
    const menus = await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date, is_open, created_at)
      VALUES (${menuDate}::date, true, NOW())
      RETURNING id
    `
    const items = await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items
        (daily_menu_id, food_id, price, capacity_portions, sold_portions, is_available, created_at)
      VALUES (${menus[0]!.id}, ${foods[0]!.id}, 100, 1, 0, true, NOW())
      RETURNING id
    `
    const reserve = () => sql.begin(async (tx) => {
      const rows = await tx<{ sold: number; capacity: number }[]>`
        SELECT sold_portions AS sold, capacity_portions AS capacity
        FROM daily_menu_items WHERE id = ${items[0]!.id}
        FOR UPDATE
      `
      if (rows[0]!.sold >= rows[0]!.capacity) return false
      await tx`UPDATE daily_menu_items SET sold_portions = sold_portions + 1 WHERE id = ${items[0]!.id}`
      return true
    })
    const results = await Promise.all([reserve(), reserve()])
    expect(results.filter(Boolean)).toHaveLength(1)
    const final = await sql<{ sold: number }[]>`
      SELECT sold_portions AS sold FROM daily_menu_items WHERE id = ${items[0]!.id}
    `
    expect(final[0]?.sold).toBe(1)
    await sql`DELETE FROM daily_menus WHERE id = ${menus[0]!.id}`
    await sql`DELETE FROM foods WHERE id = ${foods[0]!.id}`
    await sql`DELETE FROM food_categories WHERE id = ${categories[0]!.id}`
  })

  it('keeps numeric money exact to two decimal places', async () => {
    const rows = await sql<{ value: string }[]>`SELECT 1234567890123456.78::numeric(18,2)::text AS value`
    expect(rows[0]?.value).toBe('1234567890123456.78')
  })
})
