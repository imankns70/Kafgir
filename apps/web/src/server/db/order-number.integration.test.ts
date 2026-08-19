import { DeliveryMethod, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  createOrder,
  persianBusinessYear,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * Regression cover for the order-number counter in `createOrder`.
 *
 * The counter is `MAX(numeric suffix) + 1` over every order sharing the current Persian year prefix,
 * taken under `pg_advisory_xact_lock`. It has already failed once in production: bound untyped, the
 * `substring(order_number from N)` offset resolved to the POSIX-regex overload, so every order in a
 * year collapsed onto the same counter value. Nothing guarded that until this file.
 *
 * The suffixes seeded below are deliberately huge (1e8–2e9) so they dominate whatever real orders the
 * test database already holds for the current year — the counter is global per year, so a test cannot
 * carve out a private namespace. They stay under 2^31 because the expression casts to `int`.
 */

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()
const menuDate = '2099-06-01'
const anonymous = { userId: null, username: null, firstName: null, lastName: null }

let sql: ReturnType<typeof postgres>
let categoryId = 0
let menuId = 0
let menuItemId = 0
let year = ''
/** Order numbers this file put in the table, synthetic or created. Dropped after every test. */
let owned: string[] = []

const orderRequest = () => ({
  fullName: 'مشتری شماره سفارش',
  phoneNumber: '09000000002',
  city: 'اندیمشک',
  addressLine: 'آدرس تست',
  saveAddress: false,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Pickup,
  customerNote: null,
  items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity: 1 }],
})

/** Inserts an order that exists only to occupy an order number. */
async function seedOrderNumber(orderNumber: string) {
  await sql`
    INSERT INTO orders
      (order_number, delivery_full_name, delivery_phone_number, delivery_city,
       delivery_address_line, status, payment_method, delivery_method,
       subtotal_amount, delivery_fee, total_amount, created_at)
    VALUES
      (${orderNumber}, 'seed', '09000000003', 'اندیمشک', 'نشانی', 1, ${PaymentMethod.Cash},
       ${DeliveryMethod.Pickup}, 100, 0, 100, NOW())
  `
  owned.push(orderNumber)
  return orderNumber
}

async function placeOrder() {
  const created = await createOrder(orderRequest(), anonymous, true)
  const rows = await sql<{ orderNumber: string }[]>`
    SELECT order_number AS "orderNumber" FROM orders WHERE id = ${created.id}
  `
  const orderNumber = rows[0]!.orderNumber
  owned.push(orderNumber)
  return orderNumber
}

integration.sequential('order number generation', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 10, prepare: false })
    await configureDatabase(connectionString!, 10)
    year = String(persianBusinessYear())

    // Checkout reads these gates before it reaches the counter, so the file sets the two it uses
    // rather than depending on whatever seed the database happens to carry.
    await sql`
      INSERT INTO payment_method_settings (method, title, is_manual_enabled, updated_at)
      VALUES (${PaymentMethod.Cash}, 'نقدی', true, NOW())
      ON CONFLICT (method) DO UPDATE SET is_manual_enabled = true, updated_at = NOW()
    `
    await sql`
      INSERT INTO delivery_method_settings
        (method, title, is_manual_enabled, delivery_fee, minimum_order_amount, updated_at)
      VALUES (${DeliveryMethod.Pickup}, 'حضوری', true, 0, 0, NOW())
      ON CONFLICT (method) DO UPDATE SET
        is_manual_enabled = true, delivery_fee = 0, minimum_order_amount = 0, updated_at = NOW()
    `

    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${`دسته ${suffix}`},${`cat-${suffix}`},true,NOW(),NOW()) RETURNING id`)[0]!.id
    const foodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,
        is_active,created_at,updated_at)
      VALUES (${`غذای ${suffix}`},${`food-${suffix}`},${categoryId},100,false,false,true,NOW(),NOW())
      RETURNING id`)[0]!.id
    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at)
      VALUES (${menuDate}::date,true,NOW()) RETURNING id`)[0]!.id
    menuItemId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items
        (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${menuId},${foodId},100,5000,0,true,NOW()) RETURNING id`)[0]!.id
  })

  afterEach(async () => {
    if (!owned.length) return
    await sql`DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE order_number = ANY(${owned}))`
    await sql`DELETE FROM order_status_histories WHERE order_id IN (
      SELECT id FROM orders WHERE order_number = ANY(${owned}))`
    await sql`DELETE FROM notification_messages WHERE order_id IN (
      SELECT id FROM orders WHERE order_number = ANY(${owned}))`
    await sql`DELETE FROM orders WHERE order_number = ANY(${owned})`
    owned = []
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM daily_menu_items WHERE id = ${menuItemId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE slug = ${`food-${suffix}`}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql.end()
    await closeDatabase()
  })

  it('prefixes the number with the current Persian year and advances by one', async () => {
    await seedOrderNumber(`${year}400000010`)

    expect(await placeOrder()).toBe(`${year}400000011`)
  })

  it('treats the suffix as a number, not text, across the 9 to 10 boundary', async () => {
    // Numerically 1000000010 > 100000009. Lexicographically '100000009' sorts higher, because the
    // ninth character is '9' against '1'. A text MAX would therefore pick the smaller counter and
    // hand out a number that is already taken.
    await seedOrderNumber(`${year}100000009`)
    await seedOrderNumber(`${year}1000000010`)

    expect(await placeOrder()).toBe(`${year}1000000011`)
  })

  it('treats the suffix as a number across the 99 to 100 boundary', async () => {
    // Same disagreement one digit further along: 2000000100 > 200000099 numerically, while
    // '200000099' sorts higher as text.
    await seedOrderNumber(`${year}200000099`)
    await seedOrderNumber(`${year}2000000100`)

    expect(await placeOrder()).toBe(`${year}2000000101`)
  })

  it('ignores order numbers belonging to a different Persian year', async () => {
    const nextYear = String(Number(year) + 1)
    const previousYear = String(Number(year) - 1)
    await seedOrderNumber(`${nextYear}999999999`)
    await seedOrderNumber(`${previousYear}999999999`)
    await seedOrderNumber(`${year}500000007`)

    expect(await placeOrder()).toBe(`${year}500000008`)
  })

  it('ignores rows whose suffix is not numeric', async () => {
    await seedOrderNumber(`${year}ABCDEF`)
    await seedOrderNumber(`LEGACY-${suffix}`)
    await seedOrderNumber(`${year}600000004`)

    expect(await placeOrder()).toBe(`${year}600000005`)
  })

  it('assigns one unique number per order under concurrent checkouts', async () => {
    const base = 700000000
    await seedOrderNumber(`${year}${base}`)

    // Eight simultaneous checkouts. The advisory lock must serialise the read-modify-write, so the
    // numbers form a contiguous run with no repeats — a duplicate would otherwise be rejected by
    // `orders_order_number_uidx` and surface as a failed checkout.
    const created = await Promise.all(Array.from({ length: 8 }, () => placeOrder()))

    expect(new Set(created).size).toBe(8)
    const counters = created.map((value) => Number(value.slice(year.length))).sort((a, b) => a - b)
    expect(counters).toEqual(Array.from({ length: 8 }, (_, index) => base + index + 1))
    for (const value of created) expect(value.startsWith(year)).toBe(true)
  })

  it('keeps every order number unique in the table', async () => {
    const duplicates = await sql<{ orderNumber: string }[]>`
      SELECT order_number AS "orderNumber" FROM orders GROUP BY order_number HAVING COUNT(*) > 1
    `
    expect(duplicates).toEqual([])
  })
})
