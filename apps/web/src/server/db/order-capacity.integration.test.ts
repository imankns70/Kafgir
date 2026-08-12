import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import { closeDatabase, configureDatabase, createOrder, updateOrderStatus } from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()
const menuDate = '2099-05-01'
const anonymous = { userId: null, username: null, firstName: null, lastName: null }

let sql: ReturnType<typeof postgres>
let userId = 0
let categoryId = 0
let menuId = 0
let dishMenuItemId = 0
let riceMenuItemId = 0
let profileId = 0

const order = (items: Array<{ dailyMenuItemId: number; withPersianRice: boolean; quantity: number }>) => ({
  fullName: 'مشتری', phoneNumber: '09000000000', city: 'اندیمشک', addressLine: 'آدرس',
  saveAddress: false, paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Pickup, customerNote: null, items,
})

integration.sequential('order capacity across rice variants', () => {
  beforeAll(async () => {
    sql = postgres(connectionString!, { max: 2, prepare: false })
    await configureDatabase(connectionString!, 5)
    userId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`bh-${suffix}`},${`BH-${suffix}`},'bug hunt',true,NOW()) RETURNING id`)[0]!.id
    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${`c${suffix}`},${`c-${suffix}`},true,NOW(),NOW()) RETURNING id`)[0]!.id
    const food = async (name: string, slug: string, allows: boolean, isRice: boolean) =>
      (await sql<{ id: number }[]>`
        INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
        VALUES (${name},${slug},${categoryId},100,${allows},${isRice},true,NOW(),NOW()) RETURNING id`)[0]!.id
    const dishId = await food(`dish ${suffix}`, `d-${suffix}`, true, false)
    const riceId = await food(`rice ${suffix}`, `r-${suffix}`, false, true)
    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at) VALUES (${menuDate}::date,true,NOW()) RETURNING id`)[0]!.id
    const menuItem = async (foodId: number, price: number, capacity: number) =>
      (await sql<{ id: number }[]>`
        INSERT INTO daily_menu_items (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
        VALUES (${menuId},${foodId},${price},${capacity},0,true,NOW()) RETURNING id`)[0]!.id
    dishMenuItemId = await menuItem(dishId, 100, 10)   // only 10 portions exist
    riceMenuItemId = await menuItem(riceId, 50, 100)   // rice is plentiful
    profileId = (await sql<{ id: number }[]>`
      INSERT INTO customer_profiles (user_id,preferred_name,default_phone_number,created_at)
      VALUES (${userId},'c','09000000000',NOW()) RETURNING id`)[0]!.id
  })

  afterAll(async () => {
    if (!sql) return
    const orders = sql`SELECT id FROM orders WHERE customer_profile_id=${profileId}`
    await sql`DELETE FROM audit_logs WHERE user_id=${userId}`
    await sql`DELETE FROM notification_messages WHERE order_id IN (${orders})`
    await sql`DELETE FROM order_inventory_consumptions WHERE order_id IN (${orders})`
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

  it('rejects a dish split across both rice variants that together exceed its capacity', async () => {
    // Dish capacity is 10. Asking for 8 plain + 8 upgraded is 16 portions of the same dish; the two
    // lines used to each pass the per-line check and oversell it.
    await expect(createOrder(order([
      { dailyMenuItemId: dishMenuItemId, withPersianRice: false, quantity: 8 },
      { dailyMenuItemId: dishMenuItemId, withPersianRice: true, quantity: 8 },
    ]), anonymous, true, userId)).rejects.toThrow(/باقی مانده/u)
  })

  it('merges both variants of one dish into a single order line and confirms cleanly', async () => {
    const created = await createOrder(order([
      { dailyMenuItemId: dishMenuItemId, withPersianRice: false, quantity: 4 },
      { dailyMenuItemId: dishMenuItemId, withPersianRice: true, quantity: 3 },
    ]), anonymous, true, userId)

    const dishLines = created.items.filter((line) => line.dailyMenuItemId === dishMenuItemId)
    expect(dishLines).toHaveLength(1)
    expect(dishLines[0]!.quantity).toBe(7)
    const riceLine = created.items.find((line) => line.dailyMenuItemId === riceMenuItemId)!
    expect(riceLine.quantity).toBe(3)

    await updateOrderStatus(created.id, { newStatus: OrderStatus.Confirmed }, userId)
    const sold = await sql<{ sold: number }[]>`
      SELECT sold_portions sold FROM daily_menu_items WHERE id=${dishMenuItemId}`
    expect(sold[0]!.sold).toBe(7)
  })

  it('still reports a friendly Persian message when a single line exceeds capacity', async () => {
    await expect(createOrder(order([
      { dailyMenuItemId: dishMenuItemId, withPersianRice: false, quantity: 99 },
    ]), anonymous, true, userId)).rejects.toThrow(/باقی مانده/u)
  })
})
