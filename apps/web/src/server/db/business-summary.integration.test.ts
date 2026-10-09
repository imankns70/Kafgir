import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import {
  closeDatabase,
  configureDatabase,
  createOrder,
  createPurchase,
  deletePurchase,
  getDashboard,
  getMonthPurchases,
  getMonthlyReport,
  getLeftovers,
  saveLeftovers,
  jalaliMonthRange,
  saveCourierDeliveryDay,
  updateOrderStatus,
  updatePurchase,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const suffix = crypto.randomUUID()

/**
 * A far-future Jalali month, so nothing this suite writes can collide with real activity and the
 * totals are entirely its own. مرداد ۱۴۹۹ runs 2120-07-22 .. 2120-08-21.
 */
const year = 1499
const month = 5
const range = jalaliMonthRange(year, month)
const firstDay = range.fromDate
const lastDay = range.toDate
const nextMonthFirstDay = range.toExclusiveDate

let sql: ReturnType<typeof postgres>
let categoryId = 0
let foodId = 0
let menuId = 0
let menuItemId = 0
let courierId = 0
const orderIds: number[] = []
const purchaseIds: number[] = []
/** Purchases are audited against a real user, so the file brings its own instead of assuming id 1. */
let adminUserId = 0

const anonymous = { userId: null, username: null, firstName: null, lastName: null }

/** Orders are attributed by `created_at`, which the service does not let a caller choose. */
const backdateOrder = async (id: number, isoDate: string) => {
  await sql`UPDATE orders SET created_at = (${isoDate}::date + INTERVAL '9 hours') AT TIME ZONE 'Asia/Tehran' WHERE id = ${id}`
}

const placeOrder = async (quantity = 1) => {
  const order = await createOrder({
    fullName: `مشتری ${suffix}`,
    phoneNumber: '09000000077',
    city: 'x',
    addressLine: 'x',
    saveAddress: false,
    paymentMethod: PaymentMethod.Cash,
    deliveryMethod: DeliveryMethod.Delivery,
    customerNote: null,
    deliveryTimeSlotId: null,
    items: [{ dailyMenuItemId: menuItemId, withPersianRice: false, quantity }],
  } as never, anonymous, true)
  orderIds.push(order.id)
  return order
}

const addPurchase = async (purchaseDate: string, amount: number, title = 'خرید بازار') => {
  const purchase = await createPurchase({
    purchaseDate, amount, title, sellerName: null, receiptImageUrl: null, notes: null,
  }, adminUserId)
  purchaseIds.push(purchase.id)
  return purchase
}

integration.sequential('monthly business summary', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 5, prepare: false })
    await configureDatabase(connectionString!, 5)

    adminUserId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`bs-${suffix}`},${`BS-${suffix}`},'business summary',true,NOW()) RETURNING id`)[0]!.id

    categoryId = (await sql<{ id: number }[]>`
      INSERT INTO food_categories (title,slug,is_active,created_at,updated_at)
      VALUES (${suffix},${suffix},true,NOW(),NOW()) RETURNING id`)[0]!.id
    foodId = (await sql<{ id: number }[]>`
      INSERT INTO foods (name,slug,category_id,default_price,allows_persian_rice,is_persian_rice,
        is_active,created_at,updated_at)
      VALUES (${suffix},${`f-${suffix}`},${categoryId},500000,false,false,true,NOW(),NOW())
      RETURNING id`)[0]!.id
    // The order's delivery date comes from the menu it belongs to, so the menu sits in the month.
    menuId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date,is_open,created_at)
      VALUES (${firstDay},true,NOW()) RETURNING id`)[0]!.id
    menuItemId = (await sql<{ id: number }[]>`
      INSERT INTO daily_menu_items
        (daily_menu_id,food_id,price,capacity_portions,sold_portions,is_available,created_at)
      VALUES (${menuId},${foodId},500000,900,0,true,NOW()) RETURNING id`)[0]!.id

    const digits = suffix.replace(/\D/g, '').padEnd(8, '0')
    courierId = (await sql<{ id: number }[]>`
      INSERT INTO couriers (full_name,mobile,is_active,created_at)
      VALUES (${`پیک ${suffix}`},${`0915${digits.slice(0, 7)}`},true,NOW()) RETURNING id`)[0]!.id
    await saveCourierDeliveryDay({
      deliveryDate: firstDay, courierId,
      customerDeliveryFee: 70_000, courierPayablePerOrder: 60_000, isActive: true,
    })
  })

  afterAll(async () => {
    if (!sql) return
    for (const id of orderIds) {
      await sql`DELETE FROM order_status_histories WHERE order_id = ${id}`
      await sql`DELETE FROM notification_messages WHERE order_id = ${id}`
      await sql`DELETE FROM order_items WHERE order_id = ${id}`
      await sql`DELETE FROM orders WHERE id = ${id}`
    }
    await sql`DELETE FROM purchases WHERE purchase_date >= ${firstDay} AND purchase_date <= ${nextMonthFirstDay}`
    await sql`DELETE FROM courier_delivery_days WHERE courier_id = ${courierId}`
    await sql`DELETE FROM couriers WHERE id = ${courierId}`
    await sql`DELETE FROM daily_menu_items WHERE id = ${menuItemId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE id = ${foodId}`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql`DELETE FROM audit_logs WHERE user_id = ${adminUserId}`
    await sql`DELETE FROM users WHERE id = ${adminUserId}`
    await sql.end()
    await closeDatabase()
  })

  it('reports an empty month without dividing by zero', async () => {
    const { summary } = await getMonthlyReport(year, month)
    expect(summary.title).toContain('مرداد')
    expect(summary.foodSales).toBe(0)
    expect(summary.purchases).toBe(0)
    expect(summary.salesMinusPurchases).toBe(0)
    // The ratio is unanswerable, not Infinity.
    expect(summary.purchaseToSalesPercent).toBeNull()
  })

  it('assigns a purchase to the month its date falls in', async () => {
    await addPurchase(firstDay, 3_200_000, 'خرید بازار')
    await addPurchase(lastDay, 1_200_000, 'خرید تکمیلی مرغ')
    // The day after the month ends belongs to the next month, not this one.
    await addPurchase(nextMonthFirstDay, 9_999_000, 'خرید ماه بعد')

    const monthly = await getMonthPurchases(year, month)
    expect(monthly.purchases).toHaveLength(2)
    expect(monthly.totalAmount).toBe(4_400_000)
    expect(monthly.purchases.map((purchase) => purchase.title))
      .toEqual(['خرید تکمیلی مرغ', 'خرید بازار'])
  })

  it('adds up several purchases made on one day', async () => {
    await addPurchase(firstDay, 500_000, 'خرید دوم همان روز')
    const monthly = await getMonthPurchases(year, month)
    expect(monthly.totalAmount).toBe(4_900_000)
    const sameDay = monthly.purchases.filter((purchase) => purchase.purchaseDate === firstDay)
    expect(sameDay).toHaveLength(2)
  })

  it('corrects a purchase in place rather than by a reversing entry', async () => {
    const purchase = await addPurchase(firstDay, 111_000, 'مبلغ اشتباه')
    const corrected = await updatePurchase(purchase.id, {
      purchaseDate: firstDay, amount: 222_000, title: 'مبلغ اصلاح‌شده',
      sellerName: null, receiptImageUrl: null, notes: null,
    }, adminUserId)
    expect(corrected.amount).toBe(222_000)

    const afterEdit = await getMonthPurchases(year, month)
    expect(afterEdit.totalAmount).toBe(5_122_000)
    // One row, not an original plus a counter-entry.
    expect(afterEdit.purchases.filter((row) => row.id === purchase.id)).toHaveLength(1)

    await deletePurchase(purchase.id, adminUserId)
    expect((await getMonthPurchases(year, month)).totalAmount).toBe(4_900_000)
  })

  it('saves nothing when the purchase cannot be audited', async () => {
    // No such user, so the audit row violates its foreign key after the purchase insert succeeded.
    await expect(createPurchase({
      purchaseDate: firstDay, amount: 333_000, title: 'بدون ردپا',
      sellerName: null, receiptImageUrl: null, notes: null,
    }, 2_147_483_000)).rejects.toThrow()
    expect((await getMonthPurchases(year, month)).totalAmount).toBe(4_900_000)
  })

  it('counts only delivered orders as sales, and counts food rather than the delivery charge', async () => {
    const delivered = await placeOrder(2)
    expect(delivered.subtotalAmount).toBe(1_000_000)
    expect(delivered.deliveryFee).toBe(70_000)
    expect(delivered.totalAmount).toBe(1_070_000)
    await backdateOrder(delivered.id, firstDay)

    const beforeDelivery = await getMonthlyReport(year, month)
    expect(beforeDelivery.summary.foodSales).toBe(0)

    await updateOrderStatus(delivered.id, { newStatus: OrderStatus.Confirmed })
    expect((await getMonthlyReport(year, month)).summary.foodSales).toBe(0)

    await updateOrderStatus(delivered.id, { newStatus: OrderStatus.Delivered })
    const { summary } = await getMonthlyReport(year, month)
    // 1,000,000 of food — the 70,000 delivery charge is not food revenue.
    expect(summary.foodSales).toBe(1_000_000)
    expect(summary.orderCount).toBe(1)
    // Courier pay is reported beside the comparison, not folded into purchases.
    expect(summary.courierCost).toBe(60_000)
    expect(summary.purchases).toBe(4_900_000)
  })

  it('excludes a cancelled order from sales', async () => {
    const before = (await getMonthlyReport(year, month)).summary.foodSales
    const cancelled = await placeOrder(1)
    await backdateOrder(cancelled.id, firstDay)
    await updateOrderStatus(cancelled.id, { newStatus: OrderStatus.Cancelled })
    expect((await getMonthlyReport(year, month)).summary.foodSales).toBe(before)
  })

  it('computes sales minus purchases and the ratio from the numbers', async () => {
    const { summary } = await getMonthlyReport(year, month)
    expect(summary.salesMinusPurchases).toBe(summary.foodSales - summary.purchases)
    expect(summary.purchaseToSalesPercent)
      .toBe(Math.round((summary.purchases / summary.foodSales) * 1000) / 10)
  })

  it('breaks the delivered orders down by dish, window and payment method, with cancellation rate', async () => {
    const { analysis } = await getMonthlyReport(year, month)
    // One delivered order of two portions, one cancelled order.
    expect(analysis.deliveredOrders).toBe(1)
    expect(analysis.cancelledOrders).toBe(1)
    expect(analysis.cancellationPercent).toBe(50)
    expect(analysis.averageBasket).toBe(1_000_000)
    expect(analysis.averagePortions).toBe(2)
    expect(analysis.dishes).toEqual([{ foodName: suffix, portions: 2, orders: 1, sales: 1_000_000, estimatedCost: null }])
    // Once the dish has a cost, the month shows portions × cost.
    await sql`UPDATE foods SET estimated_cost_per_portion = 180000 WHERE id = ${foodId}`
    expect((await getMonthlyReport(year, month)).analysis.dishes[0]!.estimatedCost).toBe(360_000)

    // The kitchen counts three portions left at closing; two were sold that day.
    const items = await getLeftovers(firstDay)
    expect(items.map((item) => item.soldPortions)).toEqual([2])
    await saveLeftovers({ date: firstDay, items: [{ dailyMenuItemId: menuItemId, leftoverPortions: 3 }] }, adminUserId)
    expect((await getLeftovers(firstDay))[0]!.leftoverPortions).toBe(3)
    const withLeftovers = (await getMonthlyReport(year, month)).analysis
    expect(withLeftovers.leftoverPortions).toBe(3)
    expect(withLeftovers.leftoverPercent).toBe(60)
    await expect(saveLeftovers({ date: lastDay, items: [{ dailyMenuItemId: menuItemId, leftoverPortions: 1 }] }, adminUserId))
      .rejects.toThrow(/منوی این روز/u)
    expect(analysis.slots).toEqual([{ label: 'بدون بازه ارسال', orders: 1, sales: 1_000_000 }])
    expect(analysis.paymentMethods).toEqual([{ paymentMethod: PaymentMethod.Cash, orders: 1, sales: 1_000_000 }])
  })

  it('gives the month a row per day, with zeros where nothing happened', async () => {
    const { daily } = await getMonthlyReport(year, month)
    expect(daily).toHaveLength(31)
    expect(daily[0]!.date).toBe(firstDay)
    expect(daily[0]!.dayOfMonth).toBe(1)
    expect(daily.at(-1)!.date).toBe(lastDay)
    expect(daily[0]!.purchases).toBeGreaterThan(0)
    // A quiet day is present as zero rather than missing from the series.
    const quiet = daily.find((point) => point.date !== firstDay && point.date !== lastDay)!
    expect(quiet.foodSales).toBe(0)
    expect(quiet.purchases).toBe(0)
  })

  it('keeps a historical month stable when today is a different month', async () => {
    const first = await getMonthlyReport(year, month)
    const second = await getMonthlyReport(year, month)
    expect(second.summary).toEqual(first.summary)
  })

  it('serves the dashboard from one call, without needing visitor analytics', async () => {
    const dashboard = await getDashboard()
    expect(dashboard.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
    expect(dashboard.month.title).toBeTruthy()
    expect(dashboard.monthDaily.length).toBeGreaterThan(27)
    // The payload carries business figures only; visitor statistics live on their own page now.
    expect(dashboard).not.toHaveProperty('uniqueVisitorsToday')
    expect(JSON.stringify(dashboard)).not.toContain('conversionRate')
  })
})
