import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  createOrder,
  getPublicMenuPageByDate,
  updateOrderStatus,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()
const menuDate = '2099-03-01'
const anonymous = { userId: null, username: null, firstName: null, lastName: null }

let sql: ReturnType<typeof postgres>
let userId = 0
let categoryId = 0
let menuId = 0
let dishMenuItemId = 0
let plainMenuItemId = 0
let riceMenuItemId = 0
let standaloneRiceMenuItemId = 0
let profileId = 0

async function soldPortionsOf(menuItemId: number) {
  const rows = await sql<{ sold: number }[]>`
    SELECT sold_portions sold FROM daily_menu_items WHERE id=${menuItemId}`
  return rows[0]!.sold
}

const orderRequest = (dailyMenuItemId: number, withPersianRice: boolean, quantity: number) => ({
  fullName: 'مشتری تست برنج',
  phoneNumber: '09000000000',
  city: 'اندیمشک',
  addressLine: 'آدرس تست',
  saveAddress: false,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Pickup,
  customerNote: null,
  items: [{ dailyMenuItemId, withPersianRice, quantity }],
})

integration.sequential('optional Persian rice upgrade', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 2, prepare: false })
    await configureDatabase(connectionString!, 5)

    userId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`rice-${suffix}`},${`RICE-${suffix}`},'Rice integration',true,NOW()) RETURNING id`)[0]!.id
    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${`دسته ${suffix}`},${`cat-${suffix}`},true,NOW(),NOW()) RETURNING id`)[0]!.id

    const food = async (name: string, slug: string, allowsRice: boolean, isRice: boolean) =>
      (await sql<{ id: number }[]>`
        INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,
          is_active,created_at,updated_at)
        VALUES (${name},${slug},${categoryId},100,${allowsRice},${isRice},true,NOW(),NOW())
        RETURNING id`)[0]!.id
    const dishFoodId = await food(`غذای برنجی ${suffix}`, `dish-${suffix}`, true, false)
    const plainFoodId = await food(`غذای ساده ${suffix}`, `plain-${suffix}`, false, false)
    const riceFoodId = await food(`برنج ایرانی ${suffix}`, `iranian-${suffix}`, false, true)
    const standaloneRiceFoodId = await food(`یک پرس برنج ایرانی ${suffix}`, `rice-side-${suffix}`, false, false)

    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at)
      VALUES (${menuDate}::date,true,NOW()) RETURNING id`)[0]!.id
    const menuItem = async (foodId: number, price: number, capacity: number) =>
      (await sql<{ id: number }[]>`
        INSERT INTO daily_menu_items
          (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
        VALUES (${menuId},${foodId},${price},${capacity},0,true,NOW()) RETURNING id`)[0]!.id
    // The dish sells 10 portions regardless of rice; only 2 Persian upgrades exist.
    dishMenuItemId = await menuItem(dishFoodId, 100, 10)
    plainMenuItemId = await menuItem(plainFoodId, 80, 5)
    riceMenuItemId = await menuItem(riceFoodId, 55, 2)
    standaloneRiceMenuItemId = await menuItem(standaloneRiceFoodId, 150, 3)

    profileId = (await sql<{ id: number }[]>`
      INSERT INTO customer_profiles (user_id,preferred_name,default_phone_number,created_at)
      VALUES (${userId},'Rice customer','09000000000',NOW()) RETURNING id`)[0]!.id
  })

  afterAll(async () => {
    if (!sql) return
    const orders = sql`SELECT id FROM orders WHERE customer_profile_id=${profileId}`
    await sql`DELETE FROM audit_logs WHERE user_id=${userId}`
    await sql`DELETE FROM notification_messages WHERE order_id IN (${orders})`
    await sql`DELETE FROM order_status_histories WHERE order_id IN (${orders})`
    await sql`DELETE FROM order_items WHERE order_id IN (${orders})`
    await sql`DELETE FROM orders WHERE customer_profile_id=${profileId}`
    await sql`DELETE FROM customer_profiles WHERE id=${profileId}`
    await sql`DELETE FROM daily_menu_items WHERE daily_menu_id=${menuId}`
    await sql`DELETE FROM daily_menus WHERE id=${menuId}`
    await sql`DELETE FROM foods WHERE category_id=${categoryId}`
    await sql`DELETE FROM food_categories WHERE id=${categoryId}`
    await sql`DELETE FROM users WHERE id=${userId}`
    await closeDatabase()
    await sql.end()
  })

  it('hides the upgrade but publishes a full standalone Persian-rice portion', async () => {
    const menu = await getPublicMenuPageByDate(menuDate, { q: '', category: '', limit: 12 })
    expect(menu?.items.map((item) => item.id).sort())
      .toEqual([dishMenuItemId, plainMenuItemId, standaloneRiceMenuItemId].sort())
    expect(menu?.persianRice?.menuItemId).toBe(riceMenuItemId)
    expect(menu?.persianRice?.price).toBe(55)

    const dish = menu?.items.find((item) => item.id === dishMenuItemId)
    expect(dish?.allowsPersianRice).toBe(true)
    // The upgrade is optional, so the scarce rice never caps the dish.
    expect(dish?.remainingPortions).toBe(10)
    expect(menu?.items.find((item) => item.id === plainMenuItemId)?.allowsPersianRice).toBe(false)
    expect(menu?.items.find((item) => item.id === standaloneRiceMenuItemId)?.price).toBe(150)
  })

  it('orders the standalone Persian-rice portion as an ordinary food', async () => {
    const order = await createOrder(orderRequest(standaloneRiceMenuItemId, false, 1), anonymous, true, userId)
    expect(order.items).toHaveLength(1)
    expect(order.items[0]?.dailyMenuItemId).toBe(standaloneRiceMenuItemId)
    expect(order.totalAmount).toBe(150)

    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed }, userId)
    expect(await soldPortionsOf(standaloneRiceMenuItemId)).toBe(1)
  })

  it('orders a rice-capable dish without the upgrade as a single line', async () => {
    const order = await createOrder(orderRequest(dishMenuItemId, false, 2), anonymous, true, userId)
    expect(order.items).toHaveLength(1)
    expect(order.totalAmount).toBe(200)
  })

  it('refuses the upgrade on a dish that does not allow it', async () => {
    await expect(createOrder(orderRequest(plainMenuItemId, true, 1), anonymous, true, userId))
      .rejects.toThrow(/امکان افزودن برنج ایرانی ندارد/u)
  })

  it('refuses ordering the Persian rice food directly as a dish', async () => {
    await expect(createOrder(orderRequest(riceMenuItemId, false, 1), anonymous, true, userId))
      .rejects.toThrow(/فقط به‌عنوان افزودن/u)
  })

  it('expands the upgrade into its own priced order line', async () => {
    const order = await createOrder(orderRequest(dishMenuItemId, true, 1), anonymous, true, userId)
    expect(order.items).toHaveLength(2)
    const rice = order.items.find((item) => item.dailyMenuItemId === riceMenuItemId)!
    expect(rice.unitPrice).toBe(55)
    expect(rice.quantity).toBe(1)
    // 1 × 100 for the dish plus 1 × 55 for the upgrade.
    expect(order.totalAmount).toBe(155)
  })

  /**
   * Confirming an order counts portions sold and nothing else. It used to also consume recipe
   * ingredients from a stock ledger; that dependency is gone, and this is what proves the order
   * lifecycle no longer reaches into anything but the menu.
   */
  it('counts portions for both lines when an upgraded order is confirmed', async () => {
    const order = await createOrder(orderRequest(dishMenuItemId, true, 1), anonymous, true, userId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed }, userId)

    expect(await soldPortionsOf(dishMenuItemId)).toBe(1)
    expect(await soldPortionsOf(riceMenuItemId)).toBe(1)
  })

  it('keeps the dish orderable once the Persian rice sells out', async () => {
    const upgraded = await createOrder(orderRequest(dishMenuItemId, true, 1), anonymous, true, userId)
    await updateOrderStatus(upgraded.id, { newStatus: OrderStatus.Confirmed }, userId)
    expect(await soldPortionsOf(riceMenuItemId)).toBe(2)

    await expect(createOrder(orderRequest(dishMenuItemId, true, 1), anonymous, true, userId))
      .rejects.toThrow(/باقی مانده/u)
    // The plain dish is unaffected by the empty rice pool.
    const plain = await createOrder(orderRequest(dishMenuItemId, false, 1), anonymous, true, userId)
    expect(plain.items).toHaveLength(1)
  })

  it('returns capacity for both lines when an upgraded order is cancelled', async () => {
    await sql`UPDATE daily_menu_items SET capacity_portions = 4 WHERE id=${riceMenuItemId}`
    const order = await createOrder(orderRequest(dishMenuItemId, true, 1), anonymous, true, userId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed }, userId)
    expect(await soldPortionsOf(riceMenuItemId)).toBe(3)

    await updateOrderStatus(order.id, { newStatus: OrderStatus.Cancelled }, userId)
    expect(await soldPortionsOf(riceMenuItemId)).toBe(2)
  })
})
