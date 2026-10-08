import { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from '@kafgir/contracts'
import {
  changePaymentStatus,
  closeDatabase,
  configureDatabase,
  createOrder,
  createPayment,
  getAdminOrderDetail,
  getMonthlyReport,
  getProductionSheet,
  jalaliMonthRange,
  listAuditLogs,
  listPayments,
  listUnpaidOrders,
  paymentReconciliation,
  refundPayment,
  searchOrdersPaged,
  updateOrderStatus,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()

/** A far-future Jalali month of its own: آبان ۱۴۹۸. */
const year = 1498
const month = 8
const range = jalaliMonthRange(year, month)
const serviceDay = range.fromDate

let sql: ReturnType<typeof postgres>
let categoryId = 0
let foodId = 0
let menuId = 0
let menuItemId = 0
let adminUserId = 0
const orderIds: number[] = []

const anonymous = { userId: null, username: null, firstName: null, lastName: null }

const placeOrder = async (quantity = 1, paymentMethod = PaymentMethod.Cash) => {
  const order = await createOrder({
    fullName: `مشتری ${suffix}`,
    phoneNumber: '09000000088',
    city: 'x',
    addressLine: 'x',
    saveAddress: false,
    paymentMethod,
    deliveryMethod: DeliveryMethod.Pickup,
    customerNote: null,
    deliveryTimeSlotId: null,
    items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity }],
  } as never, anonymous, true)
  orderIds.push(order.id)
  // Pickup orders have no delivery date; give them the menu's day, placed the evening before, so the
  // service date and the creation date disagree on purpose.
  await sql`UPDATE orders SET delivery_date = ${serviceDay}::date,
    created_at = ((${serviceDay}::date - 1) + INTERVAL '21 hours') AT TIME ZONE 'Asia/Tehran' WHERE id = ${order.id}`
  return order
}

const paidPayment = async (orderId: number, amount: number, method = PaymentMethod.Online) => {
  const id = await createPayment({ orderId, paymentMethod: method, amount }, adminUserId)
  await changePaymentStatus(id, { status: PaymentStatus.Paid }, adminUserId)
  // Confirmed on the service day, for the reconciliation.
  await sql`UPDATE payments SET paid_at = (${serviceDay}::date + INTERVAL '13 hours') AT TIME ZONE 'Asia/Tehran' WHERE id = ${id}`
  return id
}

integration.sequential('order money integrity', () => {
  beforeAll(async () => {
    if (!new URL(connectionString!).pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 5, prepare: false })
    await configureDatabase(connectionString!, 5)
    adminUserId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`om-${suffix}`},${`OM-${suffix}`},'اپراتور آزمون',true,NOW()) RETURNING id`)[0]!.id
    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${suffix},${suffix},true,NOW(),NOW()) RETURNING id`)[0]!.id
    foodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
      VALUES (${suffix},${`om-${suffix}`},${categoryId},400000,false,false,true,NOW(),NOW()) RETURNING id`)[0]!.id
    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at) VALUES (${serviceDay},true,NOW()) RETURNING id`)[0]!.id
    menuItemId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${menuId},${foodId},400000,50,0,true,NOW()) RETURNING id`)[0]!.id
  })

  afterAll(async () => {
    if (!sql) return
    for (const id of orderIds) {
      await sql`DELETE FROM payments WHERE order_id = ${id}`
      await sql`DELETE FROM order_status_histories WHERE order_id = ${id}`
      await sql`DELETE FROM notification_messages WHERE order_id = ${id}`
      await sql`DELETE FROM order_items WHERE order_id = ${id}`
      await sql`DELETE FROM orders WHERE id = ${id}`
    }
    await sql`DELETE FROM daily_menu_items WHERE id = ${menuItemId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE id = ${foodId}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql`DELETE FROM audit_logs WHERE user_id = ${adminUserId}`
    await sql`DELETE FROM users WHERE id = ${adminUserId}`
    await sql.end()
    await closeDatabase()
  })

  it('lists an order under the day it is served, not the evening it was placed', async () => {
    const order = await placeOrder()
    const served = await searchOrdersPaged({ date: serviceDay, pageSize: 100 } as never)
    expect(served.items.map((row) => row.id)).toContain(order.id)
    const evening = new Date(`${serviceDay}T00:00:00Z`)
    evening.setUTCDate(evening.getUTCDate() - 1)
    const before = await searchOrdersPaged({ date: evening.toISOString().slice(0, 10), pageSize: 100 } as never)
    expect(before.items.map((row) => row.id)).not.toContain(order.id)
  })

  it('records who changed the status and closes unconfirmed payments when the order is cancelled', async () => {
    const order = await placeOrder(1, PaymentMethod.Online)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed }, adminUserId)
    await paidPayment(order.id, 300_000)
    const pending = await createPayment({ orderId: order.id, paymentMethod: PaymentMethod.CardToCard, amount: 100_000 }, adminUserId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Cancelled }, adminUserId)

    const detail = await getAdminOrderDetail(order.id)
    expect(detail.statusChanges.at(-1)).toMatchObject({ toStatus: OrderStatus.Cancelled, changedBy: 'اپراتور آزمون' })
    // Paid money stays paid until someone hands it back; the order now owes it to the customer.
    expect(detail.paymentSummary).toMatchObject({ paid: 300_000, pending: 0, balance: -300_000 })
    const [status] = await sql<{ status: number }[]>`SELECT status FROM payments WHERE id = ${pending}`
    expect(status!.status).toBe(PaymentStatus.Cancelled)

    const due = await listPayments('refundDue', 1, 100)
    expect(due.items.map((payment) => payment.orderId)).toContain(order.id)
  })

  it('refunds part of a payment, then the rest, and never more than was paid', async () => {
    const order = await placeOrder(1, PaymentMethod.Online)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed }, adminUserId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Preparing }, adminUserId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Ready }, adminUserId)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Delivered }, adminUserId)
    const id = await paidPayment(order.id, 400_000)

    await refundPayment(id, { amount: 100_000, reason: 'سرد رسید' }, adminUserId)
    let [row] = await sql<{ status: number; refunded: number }[]>`SELECT status, refunded_amount::float8 AS refunded FROM payments WHERE id = ${id}`
    expect(row).toEqual({ status: PaymentStatus.Paid, refunded: 100_000 })

    await expect(refundPayment(id, { amount: 300_001, reason: 'بیش از مبلغ' }, adminUserId)).rejects.toThrow()
    await refundPayment(id, { amount: 300_000, reason: 'لغو کامل' }, adminUserId)
    ;[row] = await sql<{ status: number; refunded: number }[]>`SELECT status, refunded_amount::float8 AS refunded FROM payments WHERE id = ${id}`
    expect(row).toEqual({ status: PaymentStatus.Refunded, refunded: 400_000 })

    // The refund comes off food sales of the month the order was served in.
    const { summary } = await getMonthlyReport(year, month)
    expect(summary.grossFoodSales).toBe(400_000)
    expect(summary.refunds).toBe(400_000)
    expect(summary.foodSales).toBe(0)

    const log = await listAuditLogs({ search: 'سرد رسید' })
    expect(log.items.some((entry) => entry.action === 'payment.refund' && entry.userName === 'اپراتور آزمون')).toBe(true)
  })

  it('lists a delivered cash order as unpaid until its cash is recorded, and reconciles the day', async () => {
    const order = await placeOrder(2, PaymentMethod.Cash)
    for (const next of [OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready, OrderStatus.Delivered]) {
      await updateOrderStatus(order.id, { newStatus: next }, adminUserId)
    }
    const unpaid = async () => (await listUnpaidOrders(1, 100)).items.find((row) => row.orderId === order.id)
    expect(await unpaid()).toMatchObject({ totalAmount: 800_000, paidAmount: 0, balance: 800_000, serviceDate: serviceDay })

    const day = await paymentReconciliation(serviceDay)
    expect(day.unpaidDeliveredCount).toBeGreaterThanOrEqual(1)

    await paidPayment(order.id, 800_000, PaymentMethod.Cash)
    expect(await unpaid()).toBeUndefined()
    const after = await paymentReconciliation(serviceDay)
    const cash = after.methods.find((row) => row.paymentMethod === PaymentMethod.Cash)
    expect(cash?.received).toBeGreaterThanOrEqual(800_000)
    expect(after.totals.net).toBe(after.totals.received - after.totals.refunded)
  })

  it('sums the kitchen sheet by dish and status and gives each live order a packing card', async () => {
    const confirmed = await placeOrder(3)
    await updateOrderStatus(confirmed.id, { newStatus: OrderStatus.Confirmed }, adminUserId)
    const pending = await placeOrder(2)
    const sheet = await getProductionSheet(serviceDay)
    const dish = sheet.dishes.find((row) => row.foodName === suffix)!
    // Earlier tests confirmed and cancelled or delivered other orders on this day; only live ones count.
    expect(dish.toCook).toBeGreaterThanOrEqual(3)
    expect(dish.pending).toBeGreaterThanOrEqual(2)
    expect(sheet.orders.find((order) => order.id === confirmed.id)?.lines).toEqual([
      { foodName: suffix, quantity: 3, withPersianRice: false },
    ])
    expect(sheet.orders.find((order) => order.id === pending.id)?.slotTitle).toBe('تحویل حضوری')
  })
})
