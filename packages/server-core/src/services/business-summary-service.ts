import type {
  AdminDashboardSummaryDto,
  MonthListItemDto,
  MonthlyDailyPointDto,
  MonthlyReportDto,
  MonthlySummaryDto,
} from '@kafgir/contracts'
import { OrderReviewHandlingStatus, OrderStatus, PaymentStatus, SupportConversationStatus } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { orderServiceDate } from '../db/service-date'
import { paymentBucketTotals } from './payment-service'
import { businessDate } from '../time'
import {
  currentJalaliMonth,
  jalaliMonthRange,
  purchaseToSalesPercent,
  recentJalaliMonths,
  type JalaliMonthRange,
} from '../domain/jalali-month'

/**
 * The whole of Kafgir's financial reporting: what a month sold, what it bought, and how those two
 * compare.
 *
 * Three rules, all deliberate:
 *
 * - **Food sales are order subtotals**, never totals. The customer's delivery charge is money that
 *   passes through to a courier; counting it as food revenue would flatter every comparison against
 *   what the kitchen spent on ingredients.
 * - **Delivered orders only.** This is the revenue rule the customer report already states: a
 *   pending or preparing order is not money earned. Cancelled orders are excluded by construction.
 * - **Courier pay is reported beside the comparison, never inside it.** It is a real cost, but it is
 *   not a purchase, and folding it in would make the purchase-to-sales ratio mean two things.
 *
 * Every figure comes from the order's own stored snapshot, so a historical month cannot change when
 * today's prices do.
 */

/** Orders that count as a realised sale. */
const soldStatus = OrderStatus.Delivered

type MonthTotals = {
  foodSales: number
  refunds: number
  deliveryFees: number
  purchases: number
  courierCost: number
  purchaseCount: number
  orderCount: number
}

/**
 * What was handed back on an order, capped at its food subtotal: a refund comes off food sales, and
 * any part of it beyond the food (the delivery charge) is not a food sale to begin with.
 */
const refundedFood = (alias: string) => sqlClient.unsafe(`LEAST(${alias}.subtotal_amount, COALESCE((
  SELECT SUM(p.refunded_amount) FROM payments p WHERE p.order_id = ${alias}.id), 0))`)

/**
 * One round trip for a month's totals.
 *
 * Orders are attributed to their service date — the day they are cooked and delivered — while
 * purchases carry a plain `purchase_date` the operator chose. Refunds on an order come off the month
 * that order belongs to.
 */
async function monthTotals(range: JalaliMonthRange): Promise<MonthTotals> {
  const rows = await sqlClient<MonthTotals[]>`
    SELECT
      COALESCE(orders.food_sales, 0)::float8 AS "foodSales",
      COALESCE(orders.refunds, 0)::float8 AS "refunds",
      COALESCE(orders.delivery_fees, 0)::float8 AS "deliveryFees",
      COALESCE(orders.courier_cost, 0)::float8 AS "courierCost",
      COALESCE(orders.order_count, 0)::int AS "orderCount",
      COALESCE(bought.total, 0)::float8 AS "purchases",
      COALESCE(bought.count, 0)::int AS "purchaseCount"
    FROM
      (SELECT
         SUM(o.subtotal_amount) AS food_sales,
         SUM(${refundedFood('o')}) AS refunds,
         SUM(o.delivery_fee) AS delivery_fees,
         SUM(o.courier_payable_amount) AS courier_cost,
         COUNT(*) AS order_count
       FROM orders o
       WHERE o.status = ${soldStatus}
         AND ${orderServiceDate('o')} >= ${range.fromDate}::date
         AND ${orderServiceDate('o')} < ${range.toExclusiveDate}::date) orders
    CROSS JOIN
      (SELECT SUM(amount) AS total, COUNT(*) AS count
       FROM purchases
       WHERE purchase_date >= ${range.fromDate}
         AND purchase_date < ${range.toExclusiveDate}) bought
  `
  return rows[0] ?? {
    foodSales: 0, refunds: 0, deliveryFees: 0, purchases: 0, courierCost: 0, purchaseCount: 0, orderCount: 0,
  }
}

const summaryOf = (range: JalaliMonthRange, totals: MonthTotals): MonthlySummaryDto => ({
  year: range.year,
  month: range.month,
  title: range.title,
  fromDate: range.fromDate,
  toDate: range.toDate,
  foodSales: Math.max(0, totals.foodSales - totals.refunds),
  grossFoodSales: totals.foodSales,
  refunds: totals.refunds,
  deliveryFees: totals.deliveryFees,
  deliveryMargin: totals.deliveryFees - totals.courierCost,
  purchases: totals.purchases,
  salesMinusPurchases: totals.foodSales - totals.refunds - totals.purchases,
  purchaseToSalesPercent: purchaseToSalesPercent(totals.purchases, totals.foodSales - totals.refunds),
  courierCost: totals.courierCost,
  purchaseCount: totals.purchaseCount,
  orderCount: totals.orderCount,
})

/**
 * Sales against purchases for every calendar day of the month.
 *
 * `generate_series` supplies the days, so a day with no activity is a zero row rather than a gap the
 * chart would have to invent.
 */
async function dailySeries(range: JalaliMonthRange): Promise<MonthlyDailyPointDto[]> {
  const rows = await sqlClient<Array<{ date: string; foodSales: number; purchases: number }>>`
    SELECT
      days.day::text AS date,
      COALESCE((
        SELECT SUM(o.subtotal_amount - ${refundedFood('o')}) FROM orders o
        WHERE o.status = ${soldStatus}
          AND ${orderServiceDate('o')} = days.day
      ), 0)::float8 AS "foodSales",
      COALESCE((
        SELECT SUM(p.amount) FROM purchases p WHERE p.purchase_date = days.day
      ), 0)::float8 AS purchases
    -- The cast back to \`date\` matters: \`generate_series\` over dates yields \`timestamp\`, and
    -- \`timestamp + 1\` is not a thing PostgreSQL will do.
    FROM (
      SELECT generate_series(
        ${range.fromDate}::date, ${range.toDate}::date, INTERVAL '1 day'
      )::date AS day
    ) days
    ORDER BY days.day
  `
  return rows.map((row, index) => ({
    date: row.date,
    // Position within the Jalali month: day 1 is the first row because the range starts there.
    dayOfMonth: index + 1,
    foodSales: row.foodSales,
    purchases: row.purchases,
  }))
}

export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReportDto> {
  const range = jalaliMonthRange(year, month)
  const [totals, daily] = await Promise.all([monthTotals(range), dailySeries(range)])
  return { summary: summaryOf(range, totals), daily }
}

export async function getMonthlySummary(year: number, month: number): Promise<MonthlySummaryDto> {
  const range = jalaliMonthRange(year, month)
  return summaryOf(range, await monthTotals(range))
}

/**
 * The months an operator can browse, newest first.
 *
 * Derived from the calendar rather than from a stored period table: a month exists because it
 * happened, not because somebody remembered to open it.
 */
export async function listRecentMonths(count = 12): Promise<MonthListItemDto[]> {
  const months = recentJalaliMonths(Math.min(Math.max(count, 1), 36))
  const summaries = await Promise.all(
    months.map((month) => getMonthlySummary(month.year, month.month)),
  )
  return summaries.map(({ year, month, title, foodSales, purchases, salesMinusPurchases, purchaseToSalesPercent: ratio }) => ({
    year, month, title, foodSales, purchases, salesMinusPurchases, purchaseToSalesPercent: ratio,
  }))
}

/**
 * The dashboard, in one service call.
 *
 * Today's operational numbers and the current month's business numbers are aggregated in the
 * database rather than assembled from a handful of requests in the renderer.
 */
export async function getDashboard(): Promise<AdminDashboardSummaryDto> {
  const date = businessDate()
  const current = currentJalaliMonth()
  const [todayRows, month, monthDaily] = await Promise.all([
    sqlClient<Array<AdminDashboardSummaryDto['today'] & { isTodayMenuOpen: boolean | null }>>`
      WITH today_orders AS (
        SELECT *
        FROM orders
        WHERE ${orderServiceDate('orders')} = ${date}::date
      ),
      order_stats AS (
        SELECT
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (WHERE status = ${OrderStatus.PendingConfirmation})::int AS "pendingOrders",
          COUNT(*) FILTER (WHERE status IN (
            ${OrderStatus.Confirmed}, ${OrderStatus.Preparing}, ${OrderStatus.Ready}
          ))::int AS "activeOrders",
          COUNT(*) FILTER (WHERE status = ${OrderStatus.Delivered})::int AS "deliveredOrders",
          COUNT(*) FILTER (WHERE status = ${OrderStatus.Cancelled})::int AS "cancelledOrders",
          COALESCE(SUM(subtotal_amount - ${refundedFood('today_orders')}) FILTER (WHERE status = ${soldStatus}), 0)::float8 AS "foodSales"
        FROM today_orders
      ),
      portion_stats AS (
        SELECT COALESCE(SUM(oi.quantity), 0)::int AS "totalPortions"
        FROM order_items oi
        JOIN today_orders o ON o.id = oi.order_id
      )
      SELECT
        order_stats.*,
        portion_stats."totalPortions",
        (SELECT COUNT(*)::int FROM daily_menu_items dmi
           JOIN daily_menus dm ON dm.id = dmi.daily_menu_id
          WHERE dm.menu_date = ${date}::date) AS "todayMenuItems",
        (SELECT is_open FROM daily_menus WHERE menu_date = ${date}::date LIMIT 1) AS "isTodayMenuOpen"
      FROM order_stats
      CROSS JOIN portion_stats
    `,
    getMonthlySummary(current.year, current.month),
    dailySeries(jalaliMonthRange(current.year, current.month)),
  ])
  const attention = await dashboardAttention(date)
  const row = todayRows[0]
  const today: AdminDashboardSummaryDto['today'] = row
    ? { ...row, date, isTodayMenuOpen: row.isTodayMenuOpen ?? false }
    : {
      date, totalOrders: 0, pendingOrders: 0, activeOrders: 0, deliveredOrders: 0,
      cancelledOrders: 0, totalPortions: 0, foodSales: 0, todayMenuItems: 0, isTodayMenuOpen: false,
    }
  return { today, month, monthDaily, attention }
}

const lowStockThreshold = 5

/** The few things that need someone now, read in one pass each so the dashboard opens with them. */
async function dashboardAttention(date: string): Promise<AdminDashboardSummaryDto['attention']> {
  const [counts, lowStock, money] = await Promise.all([
    sqlClient<Array<{ pendingOrders: number; unpaidOrders: number; unpaidAmount: number; openSupport: number; newReviews: number }>>`
      SELECT
        (SELECT COUNT(*)::int FROM orders WHERE status = ${OrderStatus.PendingConfirmation}) AS "pendingOrders",
        (SELECT COUNT(*)::int FROM (
           SELECT o.id FROM orders o LEFT JOIN payments p ON p.order_id = o.id
           WHERE o.status = ${OrderStatus.Delivered}
           GROUP BY o.id, o.total_amount
           HAVING COALESCE(SUM(p.amount - p.refunded_amount) FILTER (WHERE p.status = ${PaymentStatus.Paid}), 0) + 0.005 < o.total_amount) unpaid) AS "unpaidOrders",
        (SELECT COALESCE(SUM(balance), 0)::float8 FROM (
           SELECT o.total_amount - COALESCE(SUM(p.amount - p.refunded_amount) FILTER (WHERE p.status = ${PaymentStatus.Paid}), 0) AS balance
           FROM orders o LEFT JOIN payments p ON p.order_id = o.id
           WHERE o.status = ${OrderStatus.Delivered}
           GROUP BY o.id, o.total_amount) owed WHERE balance > 0.005) AS "unpaidAmount",
        (SELECT COUNT(*)::int FROM support_conversations WHERE status = ${SupportConversationStatus.AwaitingAdmin}) AS "openSupport",
        (SELECT COUNT(*)::int FROM order_reviews WHERE handling_status = ${OrderReviewHandlingStatus.New}) AS "newReviews"
    `,
    sqlClient<AdminDashboardSummaryDto['attention']['lowStock']>`
      SELECT i.id AS "menuItemId", f.name AS "foodName",
             (i.capacity_portions - i.sold_portions)::int AS "remainingPortions",
             COALESCE(pending.portions, 0)::int AS "pendingPortions"
      FROM daily_menu_items i
      JOIN daily_menus m ON m.id = i.daily_menu_id
      JOIN foods f ON f.id = i.food_id
      LEFT JOIN LATERAL (
        SELECT SUM(oi.quantity) AS portions FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.daily_menu_item_id = i.id AND o.status = ${OrderStatus.PendingConfirmation}
      ) pending ON true
      WHERE m.menu_date = ${date}::date AND i.is_available AND i.capacity_portions > 0
        AND (i.capacity_portions - i.sold_portions <= ${lowStockThreshold}
             OR COALESCE(pending.portions, 0) > i.capacity_portions - i.sold_portions)
      ORDER BY i.capacity_portions - i.sold_portions, f.name
    `,
    paymentBucketTotals(),
  ])
  const row = counts[0]
  return {
    pendingOrders: row?.pendingOrders ?? 0,
    lowStock,
    unpaidOrders: row?.unpaidOrders ?? 0,
    unpaidAmount: row?.unpaidAmount ?? 0,
    refundDueCount: money.refundDue.count,
    refundDueAmount: money.refundDue.amount,
    openSupportConversations: row?.openSupport ?? 0,
    newReviews: row?.newReviews ?? 0,
  }
}
