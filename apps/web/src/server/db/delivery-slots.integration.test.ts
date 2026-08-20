import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  createOrder,
  getDeliverySlotOptions,
  getOrder,
  setDeliveryDayOverride,
  updateOrderStatus,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()
// A far-future menu date: never "today", so the cutoff never fires and capacity is the only limit.
const menuDate = '2099-04-01'
const anonymous = { userId: null, username: null, firstName: null, lastName: null }

let sql: ReturnType<typeof postgres>
let categoryId = 0
let menuId = 0
let menuItemId = 0
let noonSlotId = 0
let eveningSlotId = 0
let inactiveSlotId = 0
let courierId = 0

const orderRequest = (deliveryTimeSlotId: number | null, quantity = 1) => ({
  fullName: 'مشتری تست بازه',
  phoneNumber: '09000000001',
  city: 'اندیمشک',
  addressLine: 'آدرس تست',
  saveAddress: false,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Delivery,
  customerNote: null,
  deliveryTimeSlotId,
  items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity }],
})

integration.sequential('delivery time slots', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 5, prepare: false })
    await configureDatabase(connectionString!, 5)

    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${`دسته ${suffix}`},${`cat-${suffix}`},true,NOW(),NOW()) RETURNING id`)[0]!.id
    const foodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,
        is_active,created_at,updated_at)
      VALUES (${`غذای تست ${suffix}`},${`food-${suffix}`},${categoryId},100,false,false,true,NOW(),NOW())
      RETURNING id`)[0]!.id
    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at)
      VALUES (${menuDate},true,NOW()) RETURNING id`)[0]!.id
    menuItemId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items
        (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${menuId},${foodId},100,500,0,true,NOW()) RETURNING id`)[0]!.id

    const slot = async (title: string, start: string, end: string, isActive: boolean, sort: number) =>
      (await sql<{ id: number }[]>`
        INSERT INTO delivery_time_slots
          (title,start_time,end_time,sort_order,order_cutoff_minutes_before_start,is_active,created_at)
        VALUES (${title},${start}::time,${end}::time,${sort},60,${isActive},NOW()) RETURNING id`)[0]!.id
    noonSlotId = await slot(`ظهر ${suffix}`, '12:00', '14:00', true, 1)
    eveningSlotId = await slot(`عصر ${suffix}`, '16:00', '18:00', true, 2)
    inactiveSlotId = await slot(`نیمه‌شب ${suffix}`, '23:00', '23:30', false, 3)

    // Courier delivery now needs a priced day. These cases are about window capacity, so the day is
    // given an ordinary arrangement and left alone; the courier rules have their own suite.
    courierId = (await sql<{ id: number }[]>`
      INSERT INTO couriers (full_name, mobile, is_active, created_at)
      VALUES (${`پیک ${suffix}`}, ${`0912${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`},
              true, NOW())
      RETURNING id`)[0]!.id
    await sql`
      INSERT INTO courier_delivery_days
        (delivery_date, courier_id, customer_delivery_fee, courier_payable_per_order, is_active, created_at)
      VALUES (${menuDate}, ${courierId}, 70000, 70000, true, NOW())`
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM order_items WHERE daily_menu_item_id = ${menuItemId}`
    await sql`DELETE FROM orders WHERE delivery_date = ${menuDate}`
    await sql`DELETE FROM delivery_time_slot_availabilities WHERE delivery_date = ${menuDate}`
    await sql`DELETE FROM courier_delivery_days WHERE courier_id = ${courierId}`
    await sql`DELETE FROM couriers WHERE id = ${courierId}`
    await sql`DELETE FROM delivery_time_slots WHERE title LIKE ${`%${suffix}`}`
    await sql`DELETE FROM daily_menu_items WHERE id = ${menuItemId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE slug = ${`food-${suffix}`}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql.end()
    await closeDatabase()
  })

  it('offers active slots for a valid date and hides globally inactive ones', async () => {
    const options = await getDeliverySlotOptions(menuDate)
    const ids = options.slots.map((slot) => slot.id)
    expect(ids).toContain(noonSlotId)
    expect(ids).toContain(eveningSlotId)
    expect(ids).not.toContain(inactiveSlotId)
    expect(options.slots.find((slot) => slot.id === noonSlotId)?.isAvailable).toBe(true)
  })

  it('rejects a slot the customer submits despite it being inactive', async () => {
    await expect(createOrder(orderRequest(inactiveSlotId), anonymous, true))
      .rejects.toThrow(/بازه/u)
  })

  it('rejects an unknown slot id', async () => {
    await expect(createOrder(orderRequest(9_999_999), anonymous, true))
      .rejects.toThrow(/بازه ارسال انتخابی یافت نشد/u)
  })

  it('stores an immutable snapshot that survives later master-data edits', async () => {
    const order = await createOrder(orderRequest(noonSlotId), anonymous, true)
    expect(order.deliveryDate).toBe(menuDate)
    expect(order.deliveryStartTime).toBe('12:00')
    expect(order.deliveryEndTime).toBe('14:00')

    await sql`
      UPDATE delivery_time_slots
      SET title = ${`ظهر ویرایش‌شده ${suffix}`}, start_time = '12:30'::time, end_time = '14:30'::time
      WHERE id = ${noonSlotId}`

    const reloaded = await getOrder(order.id)
    expect(reloaded.deliveryStartTime).toBe('12:00')
    expect(reloaded.deliveryEndTime).toBe('14:00')
    expect(reloaded.deliveryTimeSlotTitle).toBe(`ظهر ${suffix}`)

    await sql`
      UPDATE delivery_time_slots
      SET title = ${`ظهر ${suffix}`}, start_time = '12:00'::time, end_time = '14:00'::time
      WHERE id = ${noonSlotId}`
    await sql`DELETE FROM order_items WHERE order_id = ${order.id}`
    await sql`DELETE FROM orders WHERE id = ${order.id}`
  })

  it('keeps an order without a slot readable', async () => {
    const order = await createOrder(orderRequest(null), anonymous, true)
    expect(order.deliveryDate).toBeNull()
    expect(order.deliveryTimeSlotTitle).toBeNull()
    const reloaded = await getOrder(order.id)
    expect(reloaded.deliveryStartTime).toBeNull()
    await sql`DELETE FROM order_items WHERE order_id = ${order.id}`
    await sql`DELETE FROM orders WHERE id = ${order.id}`
  })

  it('refuses a slot disabled for that specific date, then allows it again', async () => {
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: eveningSlotId, isAvailable: false, capacityOrders: null,
    })
    const disabled = await getDeliverySlotOptions(menuDate)
    expect(disabled.slots.find((slot) => slot.id === eveningSlotId)?.isAvailable).toBe(false)
    await expect(createOrder(orderRequest(eveningSlotId), anonymous, true)).rejects.toThrow(/فعال نیست/u)

    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: eveningSlotId, isAvailable: true, capacityOrders: null,
    })
    const enabled = await getDeliverySlotOptions(menuDate)
    expect(enabled.slots.find((slot) => slot.id === eveningSlotId)?.isAvailable).toBe(true)
  })

  it('keeps one configuration per date and slot', async () => {
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: eveningSlotId, isAvailable: true, capacityOrders: 5,
    })
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: eveningSlotId, isAvailable: true, capacityOrders: 7,
    })
    const rows = await sql<{ count: number; capacity: number }[]>`
      SELECT COUNT(*)::int count, MAX(capacity_orders)::int capacity
      FROM delivery_time_slot_availabilities
      WHERE delivery_date = ${menuDate} AND delivery_time_slot_id = ${eveningSlotId}`
    expect(rows[0]!.count).toBe(1)
    expect(rows[0]!.capacity).toBe(7)

    await expect(sql`
      INSERT INTO delivery_time_slot_availabilities
        (delivery_date,delivery_time_slot_id,is_available,capacity_orders,created_at)
      VALUES (${menuDate},${eveningSlotId},true,3,NOW())`).rejects.toThrow()
  })

  it('fills a capped slot and then refuses it', async () => {
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: noonSlotId, isAvailable: true, capacityOrders: 2,
    })
    const first = await createOrder(orderRequest(noonSlotId), anonymous, true)
    const second = await createOrder(orderRequest(noonSlotId), anonymous, true)
    await expect(createOrder(orderRequest(noonSlotId), anonymous, true))
      .rejects.toThrow(/ظرفیت این بازه زمانی تکمیل شده است/u)

    const options = await getDeliverySlotOptions(menuDate)
    expect(options.slots.find((slot) => slot.id === noonSlotId)?.isAvailable).toBe(false)

    // Cancelling frees the seat, because delivery capacity counts every non-cancelled order.
    await updateOrderStatus(second.id, { newStatus: OrderStatus.Cancelled })
    const afterCancel = await getDeliverySlotOptions(menuDate)
    expect(afterCancel.slots.find((slot) => slot.id === noonSlotId)?.isAvailable).toBe(true)
    const third = await createOrder(orderRequest(noonSlotId), anonymous, true)

    for (const id of [first.id, second.id, third.id]) {
      await sql`DELETE FROM order_items WHERE order_id = ${id}`
      await sql`DELETE FROM orders WHERE id = ${id}`
    }
  })

  it('does not oversell the final seat under concurrent checkouts', async () => {
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: eveningSlotId, isAvailable: true, capacityOrders: 3,
    })
    // Eight simultaneous attempts for three seats. The advisory lock must serialise them.
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => createOrder(orderRequest(eveningSlotId), anonymous, true)),
    )
    const accepted = attempts.filter((attempt) => attempt.status === 'fulfilled')
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected')
    expect(accepted).toHaveLength(3)
    expect(rejected).toHaveLength(5)

    const stored = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int count FROM orders
      WHERE delivery_date = ${menuDate} AND delivery_time_slot_id = ${eveningSlotId}
        AND status <> ${OrderStatus.Cancelled}`
    expect(stored[0]!.count).toBe(3)

    for (const attempt of accepted) {
      const id = (attempt as PromiseFulfilledResult<{ id: number }>).value.id
      await sql`DELETE FROM order_items WHERE order_id = ${id}`
      await sql`DELETE FROM orders WHERE id = ${id}`
    }
  })

  it('still enforces food capacity alongside delivery capacity', async () => {
    await setDeliveryDayOverride({
      deliveryDate: menuDate, deliveryTimeSlotId: noonSlotId, isAvailable: true, capacityOrders: null,
    })
    await sql`UPDATE daily_menu_items SET capacity_portions = 2, sold_portions = 0 WHERE id = ${menuItemId}`
    await expect(createOrder(orderRequest(noonSlotId, 3), anonymous, true))
      .rejects.toThrow(/پرس باقی مانده است/u)
    await sql`UPDATE daily_menu_items SET capacity_portions = 500 WHERE id = ${menuItemId}`
  })
})
