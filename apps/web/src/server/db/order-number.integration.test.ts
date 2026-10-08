import { DeliveryMethod, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  createOrder,
  formatOrderNumber,
  generateOrderNumber,
  orderNumberPattern,
  persianBusinessYear,
  searchOrders,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * Cover for order numbers in `createOrder`: `<Persian year>-<six random digits>`.
 *
 * Numbers used to be the year plus a running counter, which let any customer count Kafgir's orders.
 * These tests pin the random format, the retry on a taken number, and uniqueness under concurrent
 * checkouts. Old counter-style numbers stay in the table and must not influence new ones.
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
let userId = 0
let profileId = 0
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
      (order_number, customer_profile_id, delivery_full_name, delivery_phone_number, delivery_city,
       delivery_address_line, status, payment_method, delivery_method,
       subtotal_amount, delivery_fee, total_amount, created_at)
    VALUES
      (${orderNumber}, ${profileId}, 'seed', '09000000003', 'اندیمشک', 'نشانی', 1, ${PaymentMethod.Cash},
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
    // Every order belongs to a customer profile; the synthetic number-holders share this one.
    userId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`on-${suffix}`},${`ON-${suffix}`},'order number seed',true,NOW()) RETURNING id`)[0]!.id
    profileId = (await sql<{ id: number }[]>`
      INSERT INTO customer_profiles (user_id,preferred_name,default_phone_number,created_at)
      VALUES (${userId},'seed','09000000003',NOW()) RETURNING id`)[0]!.id
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
    await sql`DELETE FROM customer_profiles WHERE id = ${profileId}`
    await sql`DELETE FROM users WHERE id = ${userId}`
    await sql`DELETE FROM daily_menu_items WHERE id = ${menuItemId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE slug = ${`food-${suffix}`}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql.end()
    await closeDatabase()
  })

  it('formats new numbers as the Persian year, a dash and six digits', async () => {
    const orderNumber = await placeOrder()
    expect(orderNumber).toMatch(orderNumberPattern)
    expect(orderNumber.startsWith(`${year}-`)).toBe(true)
  })

  it('does not continue the old running counter', async () => {
    // A counter-style number from before the change must not become the base for the next one.
    await seedOrderNumber(`${year}400000010`)
    const orderNumber = await placeOrder()
    expect(orderNumber).not.toBe(`${year}400000011`)
    expect(orderNumber).toMatch(orderNumberPattern)
  })

  it('gives consecutive checkouts numbers that do not reveal how many orders came between', async () => {
    const created: string[] = []
    for (let index = 0; index < 6; index += 1) created.push(await placeOrder())
    const suffixes = created.map((value) => Number(value.slice(year.length + 1)))
    const steps = suffixes.slice(1).map((value, index) => value - suffixes[index]!)
    // A counter would step by exactly one every time.
    expect(steps.every((step) => step === 1)).toBe(false)
  })

  it('draws again when the random number is already taken', async () => {
    const taken = formatOrderNumber(year, 777777)
    await seedOrderNumber(taken)
    const draws = [777777, 777777, 123456]
    const orderNumber = await sql.begin((tx) => generateOrderNumber(tx, year, () => draws.shift()!))
    expect(orderNumber).toBe(formatOrderNumber(year, 123456))
    expect(draws).toEqual([])
  })

  it('assigns one unique number per order under concurrent checkouts', async () => {
    // Eight simultaneous checkouts under the year's advisory lock; a duplicate would be rejected by
    // `orders_order_number_uidx` and surface as a failed checkout.
    const created = await Promise.all(Array.from({ length: 8 }, () => placeOrder()))

    expect(new Set(created).size).toBe(8)
    for (const value of created) expect(value).toMatch(orderNumberPattern)
  })

  it('lets admin find an order by any typing of its number, on any day', async () => {
    const orderNumber = await placeOrder()
    const suffix = orderNumber.slice(year.length + 1)
    const persian = orderNumber.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!)
    // A date the order was not placed on: a number search must not be limited to the report's day.
    const otherDay = '2000-01-01'
    for (const typed of [orderNumber, persian, orderNumber.replace('-', ''), suffix]) {
      const found = await searchOrders({ date: otherDay, orderNumber: typed })
      expect(found.map((row) => row.orderNumber)).toContain(orderNumber)
    }
    // Without a number the date still applies.
    const sameDayOnly = await searchOrders({ date: otherDay })
    expect(sameDayOnly.map((row) => row.orderNumber)).not.toContain(orderNumber)
  })

  it('keeps every order number unique in the table', async () => {
    const duplicates = await sql<{ orderNumber: string }[]>`
      SELECT order_number AS "orderNumber" FROM orders GROUP BY order_number HAVING COUNT(*) > 1
    `
    expect(duplicates).toEqual([])
  })
})
