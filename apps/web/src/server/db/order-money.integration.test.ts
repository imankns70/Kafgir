import { CouponDiscountType, DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from '@kafgir/contracts'
import {
  changePaymentStatus,
  closeDatabase,
  configureDatabase,
  createOrder,
  createPayment,
  editOrder,
  checkCoupon,
  createCoupon,
  deleteCoupon,
  getCustomerDetail,
  searchCustomers,
  updateCustomerCrm,
  reopenOrder,
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
    await sql`DELETE FROM coupons WHERE title = ${suffix}`
    await sql`DELETE FROM daily_menu_items WHERE daily_menu_id = ${menuId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE category_id = ${categoryId}`
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

  it('edits a confirmed order by the difference in portions and keeps the quoted price', async () => {
    const extraFoodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
      VALUES (${`دوم ${suffix}`},${`om2-${suffix}`},${categoryId},250000,false,false,true,NOW(),NOW()) RETURNING id`)[0]!.id
    const extraItemId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${menuId},${extraFoodId},250000,3,0,true,NOW()) RETURNING id`)[0]!.id
    const order = await placeOrder(2)
    await updateOrderStatus(order.id, { newStatus: OrderStatus.Confirmed })
    const sold = async (id: number) => (await sql<{ sold: number }[]>`SELECT sold_portions AS sold FROM daily_menu_items WHERE id = ${id}`)[0]!.sold
    const soldBefore = await sold(menuItemId)
    // Today's price changed after the customer ordered; their line keeps 400,000.
    await sql`UPDATE daily_menu_items SET price = 450000 WHERE id = ${menuItemId}`

    await editOrder(order.id, {
      fullName: 'گیرنده تازه', phoneNumber: '09000000099', city: 'کرج', addressLine: 'خیابان تازه',
      items: [{ dailyMenuItemId: menuItemId, quantity: 1 }, { dailyMenuItemId: extraItemId, quantity: 2 }],
      reason: 'تماس مشتری',
    }, adminUserId)
    await sql`UPDATE daily_menu_items SET price = 400000 WHERE id = ${menuItemId}`

    const detail = await getAdminOrderDetail(order.id)
    expect(detail.subtotalAmount).toBe(400_000 + 500_000)
    expect(detail.totalAmount).toBe(detail.subtotalAmount + detail.deliveryFee)
    expect(detail.customerFullName).toBe('گیرنده تازه')
    expect(detail.addressLine).toBe('خیابان تازه')
    expect(await sold(menuItemId)).toBe(soldBefore - 1)
    expect(await sold(extraItemId)).toBe(2)
    const log = await listAuditLogs({ page: 1, pageSize: 50, entityType: 'order' } as never)
    expect(log.items.find((entry) => entry.entityId === order.id && entry.action === 'order.edit')?.details)
      .toContain('دلیل: تماس مشتری')

    // Only one portion of the extra dish is left, so asking for two more than held is refused.
    await expect(editOrder(order.id, {
      fullName: 'گیرنده تازه', phoneNumber: '09000000099',
      items: [{ dailyMenuItemId: extraItemId, quantity: 4 }],
    }, adminUserId)).rejects.toThrow(/پرس/u)

    await updateOrderStatus(order.id, { newStatus: OrderStatus.Preparing })
    await expect(editOrder(order.id, {
      fullName: 'x', phoneNumber: '09000000099', items: [{ dailyMenuItemId: menuItemId, quantity: 1 }],
    }, adminUserId)).rejects.toThrow(/آشپزخانه/u)
  })

  it('reopens a wrongly delivered or cancelled order one step back, with the reason on record', async () => {
    const delivered = await placeOrder(1)
    await updateOrderStatus(delivered.id, { newStatus: OrderStatus.Confirmed })
    await updateOrderStatus(delivered.id, { newStatus: OrderStatus.Delivered })
    expect(await reopenOrder(delivered.id, { reason: 'اشتباهی تحویل زده شد' }, adminUserId)).toBe(OrderStatus.Ready)
    const detail = await getAdminOrderDetail(delivered.id)
    expect(detail.status).toBe(OrderStatus.Ready)
    expect(detail.deliveredAt ?? null).toBeNull()
    expect(detail.statusChanges.at(-1)?.note).toContain('اشتباهی تحویل زده شد')

    const cancelled = await placeOrder(1)
    await updateOrderStatus(cancelled.id, { newStatus: OrderStatus.Cancelled })
    expect(await reopenOrder(cancelled.id, { reason: 'مشتری منصرف شد' }, adminUserId)).toBe(OrderStatus.PendingConfirmation)

    const refunded = await placeOrder(1)
    const payment = await paidPayment(refunded.id, 400_000)
    await updateOrderStatus(refunded.id, { newStatus: OrderStatus.Cancelled })
    await refundPayment(payment, { amount: 400_000, reason: 'لغو' }, adminUserId)
    await expect(reopenOrder(refunded.id, { reason: 'برگشت' }, adminUserId)).rejects.toThrow(/مسترد/u)
    await expect(reopenOrder(delivered.id, { reason: 'دوباره' }, adminUserId)).rejects.toThrow()
  })

  it('keeps a private note and tags on a customer, and a block stops only customer-app orders', async () => {
    const order = await placeOrder(1)
    const { profileId, userId } = (await sql<{ profileId: number; userId: number }[]>`
      SELECT p.id AS "profileId", p.user_id AS "userId" FROM orders o
      JOIN customer_profiles p ON p.id = o.customer_profile_id WHERE o.id = ${order.id}`)[0]!
    const tag = `آزمون-${suffix.slice(0, 8)}`
    const updated = await updateCustomerCrm(profileId, {
      adminNote: 'زنگ خراب است', tags: [tag, 'وفادار'], blocked: true, blockedReason: 'سفارش‌های پرداخت‌نشده',
    }, adminUserId)
    expect(updated.adminNote).toBe('زنگ خراب است')
    expect(updated.tags).toEqual([tag, 'وفادار'])
    expect(updated.blockedAt).not.toBeNull()

    const found = await searchCustomers({ tag, blockedOnly: true, activity: 'all', lapsedDays: 60, sort: 'lastOrder', page: 1, pageSize: 10 })
    expect(found.items.map((row) => row.customerProfileId)).toEqual([profileId])
    expect(found.items[0]!.isBlocked).toBe(true)

    const request = {
      fullName: `مشتری ${suffix}`, phoneNumber: '09000000088', city: 'x', addressLine: 'x', saveAddress: false,
      paymentMethod: PaymentMethod.Cash, deliveryMethod: DeliveryMethod.Pickup, customerNote: null,
      deliveryTimeSlotId: null, items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity: 1 }],
    } as never
    await expect(createOrder(request, anonymous, false, userId)).rejects.toThrow(/پشتیبانی/u)
    // Staff can still take the order by hand.
    const manual = await placeOrder(1)
    expect(manual.id).toBeGreaterThan(0)

    await updateCustomerCrm(profileId, { adminNote: null, tags: [], blocked: false }, adminUserId)
    const cleared = await getCustomerDetail(profileId)
    expect(cleared.blockedAt).toBeNull()
    expect(cleared.tags).toEqual([])
    const log = await listAuditLogs({ page: 1, pageSize: 50, entityType: 'customer' } as never)
    expect(log.items.filter((entry) => entry.entityId === profileId).map((entry) => entry.action))
      .toEqual(expect.arrayContaining(['customer.block', 'customer.unblock']))
  })

  it('takes a coupon off the food only, once per customer, and frees it when the order is cancelled', async () => {
    const code = `T${suffix.replace(/\W/gu, '').slice(0, 10)}`
    const coupon = await createCoupon({
      code, title: suffix, discountType: CouponDiscountType.Percent, discountValue: 10, maxDiscountAmount: 30_000,
      minOrderAmount: 300_000, usageLimit: 5, perCustomerLimit: 1, firstOrderOnly: false, isActive: true,
    }, adminUserId)
    expect((await checkCoupon(code.toLowerCase(), 400_000)).discountAmount).toBe(30_000)
    await expect(checkCoupon(code, 200_000)).rejects.toThrow(/به بالا/u)
    await expect(checkCoupon('NO-SUCH-CODE', 400_000)).rejects.toThrow(/معتبر نیست/u)

    const withCoupon = (quantity: number) => createOrder({
      fullName: `مشتری ${suffix}`, phoneNumber: '09000000088', city: 'x', addressLine: 'x', saveAddress: false,
      paymentMethod: PaymentMethod.Cash, deliveryMethod: DeliveryMethod.Pickup, customerNote: null,
      deliveryTimeSlotId: null, couponCode: code,
      items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity }],
    } as never, anonymous, true)
    const first = await withCoupon(1)
    orderIds.push(first.id)
    expect(first.discountAmount).toBe(30_000)
    expect(first.couponCode).toBe(code.toUpperCase())
    expect(first.totalAmount).toBe(first.subtotalAmount + first.deliveryFee - 30_000)
    await expect(withCoupon(1)).rejects.toThrow(/پیش‌تر/u)
    await expect(deleteCoupon(coupon.id, adminUserId)).rejects.toThrow(/غیرفعال/u)

    // Correcting the basket re-prices the coupon under its own rules: below the minimum it gives nothing.
    await editOrder(first.id, { fullName: 'x', phoneNumber: '09000000088', items: [{ dailyMenuItemId: menuItemId, quantity: 2 }] }, adminUserId)
    expect((await getAdminOrderDetail(first.id)).discountAmount).toBe(30_000)

    await updateOrderStatus(first.id, { newStatus: OrderStatus.Cancelled })
    const second = await withCoupon(1)
    orderIds.push(second.id)
    expect(second.discountAmount).toBe(30_000)
  })
})
