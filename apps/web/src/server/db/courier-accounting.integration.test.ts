import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  courierAccountSummary,
  createOrder,
  getAdminOrderDetail,
  getDeliveryPricing,
  getOrder,
  listCourierSettlements,
  recordCourierSettlement,
  saveCourierDeliveryDay,
  updateOrderStatus,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()
// Far-future dates: never "today", so window cutoffs never fire and only the courier rules are
// under test. Two dates, because "the fee follows the delivery date" is the whole point.
const menuDate = '2099-05-01'
const otherMenuDate = '2099-05-02'
const anonymous = { userId: null, username: null, firstName: null, lastName: null }

let sql: ReturnType<typeof postgres>
let categoryId = 0
let foodId = 0
let menuId = 0
let menuItemId = 0
let otherMenuId = 0
let otherMenuItemId = 0
let slotId = 0
let aliId = 0
let hassanId = 0
const createdOrderIds: number[] = []

const orderRequest = (
  itemId: number,
  deliveryMethod: DeliveryMethod = DeliveryMethod.Delivery,
  deliveryTimeSlotId: number | null = null,
) => ({
  fullName: 'مشتری تست پیک',
  phoneNumber: '09000000009',
  city: 'اندیمشک',
  addressLine: 'آدرس تست',
  saveAddress: false,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod,
  customerNote: null,
  deliveryTimeSlotId,
  items: [{ dailyMenuItemId: itemId, withPersianRice: false, quantity: 1 }],
})

const place = async (...args: Parameters<typeof orderRequest>) => {
  const order = await createOrder(orderRequest(...args), anonymous, true)
  createdOrderIds.push(order.id)
  return order
}

const configure = (deliveryDate: string, courierId: number, customerFee: number, payable: number) =>
  saveCourierDeliveryDay({
    deliveryDate,
    courierId,
    customerDeliveryFee: customerFee,
    courierPayablePerOrder: payable,
    isActive: true,
  })

integration.sequential('courier delivery pricing and accounting', () => {
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
    foodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,
        is_active,created_at,updated_at)
      VALUES (${`غذای تست ${suffix}`},${`food-${suffix}`},${categoryId},100,false,false,true,NOW(),NOW())
      RETURNING id`)[0]!.id
    const menu = async (date: string) => (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at)
      VALUES (${date},true,NOW()) RETURNING id`)[0]!.id
    const item = async (id: number) => (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items
        (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${id},${foodId},480000,500,0,true,NOW()) RETURNING id`)[0]!.id
    menuId = await menu(menuDate)
    menuItemId = await item(menuId)
    otherMenuId = await menu(otherMenuDate)
    otherMenuItemId = await item(otherMenuId)
    slotId = (await sql<{ id: number }[]>`
      INSERT INTO delivery_time_slots
        (title,start_time,end_time,sort_order,order_cutoff_minutes_before_start,is_active,created_at)
      VALUES (${`ظهر ${suffix}`},'12:00'::time,'14:00'::time,1,60,true,NOW()) RETURNING id`)[0]!.id

    const courier = async (name: string, mobile: string) => (await sql<{ id: number }[]>`
      INSERT INTO couriers (full_name,mobile,is_active,created_at)
      VALUES (${name},${mobile},true,NOW()) RETURNING id`)[0]!.id
    const digits = suffix.replace(/\D/g, '').padEnd(8, '0')
    aliId = await courier(`علی ${suffix}`, `0911${digits.slice(0, 7)}`)
    hassanId = await courier(`حسن ${suffix}`, `0913${digits.slice(0, 7)}`)
  })

  afterAll(async () => {
    if (!sql) return
    for (const id of createdOrderIds) {
      await sql`DELETE FROM order_items WHERE order_id = ${id}`
      await sql`DELETE FROM orders WHERE id = ${id}`
    }
    await sql`DELETE FROM courier_settlements WHERE courier_id IN (${aliId}, ${hassanId})`
    await sql`DELETE FROM courier_delivery_days WHERE courier_id IN (${aliId}, ${hassanId})`
    await sql`DELETE FROM couriers WHERE id IN (${aliId}, ${hassanId})`
    await sql`DELETE FROM delivery_time_slots WHERE id = ${slotId}`
    await sql`DELETE FROM daily_menu_items WHERE id IN (${menuItemId}, ${otherMenuItemId})`
    await sql`DELETE FROM daily_menus WHERE id IN (${menuId}, ${otherMenuId})`
    await sql`DELETE FROM foods WHERE id = ${foodId}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql.end()
    await closeDatabase()
  })

  it('refuses a courier order for a date with no configuration, instead of charging zero', async () => {
    await expect(place(menuItemId)).rejects.toThrow(/هزینه و پیک ارسال برای این روز هنوز مشخص نشده است/u)
  })

  it('lets a pickup order through with no courier configuration at all', async () => {
    const order = await place(menuItemId, DeliveryMethod.Pickup)
    expect(order.deliveryFee).toBe(0)
    expect(order.totalAmount).toBe(order.subtotalAmount)
    const detail = await getAdminOrderDetail(order.id)
    expect(detail.courierId).toBeNull()
    expect(detail.courierPayableAmount).toBeNull()
  })

  it('returns the configured fee for the selected delivery date, not for today', async () => {
    await configure(menuDate, aliId, 70_000, 70_000)
    await configure(otherMenuDate, aliId, 90_000, 95_000)

    const first = await getDeliveryPricing(menuDate)
    const second = await getDeliveryPricing(otherMenuDate)
    const feeOf = (pricing: Awaited<ReturnType<typeof getDeliveryPricing>>) =>
      pricing.methods.find((method) => method.method === DeliveryMethod.Delivery)?.customerDeliveryFee
    expect(feeOf(first)).toBe(70_000)
    expect(feeOf(second)).toBe(90_000)
  })

  it('never exposes the courier payable through a customer-facing payload', async () => {
    const pricing = await getDeliveryPricing(otherMenuDate)
    const method = pricing.methods.find((row) => row.method === DeliveryMethod.Delivery)!
    expect(method.customerDeliveryFee).toBe(90_000)
    expect(JSON.stringify(pricing)).not.toContain('95000')

    const order = await place(otherMenuItemId)
    const customerView = await getOrder(order.id)
    expect(customerView).not.toHaveProperty('courierPayableAmount')
    expect(JSON.stringify(customerView)).not.toContain('95000')
    // The internal amount exists — it is simply not in the customer's shape.
    expect((await getAdminOrderDetail(order.id)).courierPayableAmount).toBe(95_000)
  })

  it('adds the delivery fee to the food subtotal and snapshots both amounts', async () => {
    const order = await place(menuItemId, DeliveryMethod.Delivery, slotId)
    expect(order.subtotalAmount).toBe(480_000)
    expect(order.deliveryFee).toBe(70_000)
    expect(order.totalAmount).toBe(550_000)

    const detail = await getAdminOrderDetail(order.id)
    expect(detail.courierId).toBe(aliId)
    expect(detail.courierNameSnapshot).toBe(`علی ${suffix}`)
    expect(detail.courierPayableAmount).toBe(70_000)
  })

  it('leaves an existing order untouched when the day is later re-priced and re-assigned', async () => {
    const before = await place(menuItemId)
    expect(before.deliveryFee).toBe(70_000)

    // Mid-day change: new courier, higher customer fee, higher payable.
    await configure(menuDate, hassanId, 80_000, 85_000)

    const reloaded = await getAdminOrderDetail(before.id)
    expect(reloaded.deliveryFee).toBe(70_000)
    expect(reloaded.totalAmount).toBe(550_000)
    expect(reloaded.courierId).toBe(aliId)
    expect(reloaded.courierNameSnapshot).toBe(`علی ${suffix}`)
    expect(reloaded.courierPayableAmount).toBe(70_000)

    const after = await getAdminOrderDetail((await place(menuItemId)).id)
    expect(after.deliveryFee).toBe(80_000)
    expect(after.courierId).toBe(hassanId)
    expect(after.courierPayableAmount).toBe(85_000)

    // Put the day back so the remaining cases work from a known arrangement.
    await configure(menuDate, aliId, 70_000, 70_000)
  })

  it('earns the courier nothing until the order is actually delivered', async () => {
    const start = await courierAccountSummary(aliId)
    const order = await place(menuItemId)

    const earnedNow = async () => (await courierAccountSummary(aliId)).earnedAmount
    expect(await earnedNow()).toBe(start.earnedAmount) // PendingConfirmation
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed })
    expect(await earnedNow()).toBe(start.earnedAmount)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Preparing })
    expect(await earnedNow()).toBe(start.earnedAmount)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Ready })
    expect(await earnedNow()).toBe(start.earnedAmount)

    await updateOrderStatus(order.id, { newStatus: OrderStatus.Delivered })
    const delivered = await courierAccountSummary(aliId)
    expect(delivered.earnedAmount).toBe(start.earnedAmount + 70_000)
    expect(delivered.deliveredOrders).toBe(start.deliveredOrders + 1)
  })

  it('earns nothing for a cancelled order', async () => {
    const start = await courierAccountSummary(aliId)
    const order = await place(menuItemId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Cancelled })
    const after = await courierAccountSummary(aliId)
    expect(after.earnedAmount).toBe(start.earnedAmount)
    expect(after.deliveredOrders).toBe(start.deliveredOrders)
  })

  it('keeps past earnings stable when the daily rate changes afterwards', async () => {
    const before = await courierAccountSummary(aliId)
    await configure(menuDate, aliId, 120_000, 130_000)
    expect((await courierAccountSummary(aliId)).earnedAmount).toBe(before.earnedAmount)
    await configure(menuDate, aliId, 70_000, 70_000)
  })

  it('reduces the outstanding balance without touching any order snapshot', async () => {
    const before = await courierAccountSummary(aliId)
    expect(before.outstandingAmount).toBeGreaterThan(0)

    const snapshotsBefore = await sql<{ id: number; payable: number }[]>`
      SELECT id, courier_payable_amount::float8 AS payable FROM orders
      WHERE courier_id = ${aliId} ORDER BY id`

    const settled = await recordCourierSettlement({ courierId: aliId, amount: 50_000, note: 'تسویه تست' })
    expect(settled.settledAmount).toBe(before.settledAmount + 50_000)
    expect(settled.earnedAmount).toBe(before.earnedAmount)
    expect(settled.outstandingAmount).toBe(before.outstandingAmount - 50_000)

    const snapshotsAfter = await sql<{ id: number; payable: number }[]>`
      SELECT id, courier_payable_amount::float8 AS payable FROM orders
      WHERE courier_id = ${aliId} ORDER BY id`
    expect(snapshotsAfter).toEqual(snapshotsBefore)

    const history = await listCourierSettlements(aliId)
    expect(history[0]!.amount).toBe(50_000)
    expect(history[0]!.note).toBe('تسویه تست')
  })

  it('refuses a settlement larger than the outstanding balance', async () => {
    const current = await courierAccountSummary(aliId)
    await expect(recordCourierSettlement({
      courierId: aliId, amount: current.outstandingAmount + 1, note: null,
    })).rejects.toThrow(/مانده/u)
    expect((await courierAccountSummary(aliId)).settledAmount).toBe(current.settledAmount)
  })

  it('keeps one active configuration per date under concurrent checkouts', async () => {
    // Eight simultaneous orders while the day is being re-priced. Whatever interleaving occurs, no
    // order may end up with one configuration's courier and another's amounts.
    const attempts = await Promise.allSettled([
      ...Array.from({ length: 8 }, () => place(menuItemId)),
      configure(menuDate, hassanId, 80_000, 85_000),
    ])
    expect(attempts.some((attempt) => attempt.status === 'fulfilled')).toBe(true)

    const rows = await sql<{ courierId: number; fee: number; payable: number }[]>`
      SELECT o.courier_id AS "courierId", o.delivery_fee::float8 AS fee,
             o.courier_payable_amount::float8 AS payable
      FROM orders o
      JOIN courier_delivery_days d ON d.id = o.courier_delivery_day_id
      WHERE d.delivery_date = ${menuDate}`
    // Every stored order must match one whole configuration for this date, never a mixture of two:
    // Ali always with 70,000/70,000 and Hassan always with 80,000/85,000.
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect([
        { courierId: aliId, fee: 70_000, payable: 70_000 },
        { courierId: hassanId, fee: 80_000, payable: 85_000 },
      ]).toContainEqual(row)
    }

    const active = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM courier_delivery_days
      WHERE delivery_date = ${menuDate} AND is_active`
    expect(active[0]!.count).toBe(1)
  })
})
