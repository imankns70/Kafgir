import type {
  AdminDashboardSummaryDto,
  MonthListItemDto,
  MonthlyDailyPointDto,
  MonthlyReportDto,
  MonthlySummaryDto,
} from '@kafgir/contracts'
import { OrderStatus } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
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
  purchases: number
  courierCost: number
  purchaseCount: number
  orderCount: number
}

/**
 * One round trip for a month's totals.
 *
 * Orders are attributed by `created_at` in Tehran — the same rule the order grid and the customer
 * report use — while purchases carry a plain `purchase_date` the operator chose.
 */
async function monthTotals(range: JalaliMonthRange): Promise<MonthTotals> {
  const rows = await sqlClient<MonthTotals[]>`
    SELECT
      COALESCE(orders.food_sales, 0)::float8 AS "foodSales",
      COALESCE(orders.courier_cost, 0)::float8 AS "courierCost",
      COALESCE(orders.order_count, 0)::int AS "orderCount",
      COALESCE(bought.total, 0)::float8 AS "purchases",
      COALESCE(bought.count, 0)::int AS "purchaseCount"
    FROM
      (SELECT
         SUM(subtotal_amount) AS food_sales,
         SUM(courier_payable_amount) AS courier_cost,
         COUNT(*) AS order_count
       FROM orders
       WHERE status = ${soldStatus}
         AND created_at >= (${range.fromDate}::date AT TIME ZONE 'Asia/Tehran')
         AND created_at < (${range.toExclusiveDate}::date AT TIME ZONE 'Asia/Tehran')) orders
    CROSS JOIN
      (SELECT SUM(amount) AS total, COUNT(*) AS count
       FROM purchases
       WHERE purchase_date >= ${range.fromDate}
         AND purchase_date < ${range.toExclusiveDate}) bought
  `
  return rows[0] ?? {
    foodSales: 0, purchases: 0, courierCost: 0, purchaseCount: 0, orderCount: 0,
  }
}

const summaryOf = (range: JalaliMonthRange, totals: MonthTotals): MonthlySummaryDto => ({
  year: range.year,
  month: range.month,
  title: range.title,
  fromDate: range.fromDate,
  toDate: range.toDate,
  foodSales: totals.foodSales,
  purchases: totals.purchases,
  salesMinusPurchases: totals.foodSales - totals.purchases,
  purchaseToSalesPercent: purchaseToSalesPercent(totals.purchases, totals.foodSales),
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
        SELECT SUM(o.subtotal_amount) FROM orders o
        WHERE o.status = ${soldStatus}
          AND o.created_at >= (days.day AT TIME ZONE 'Asia/Tehran')
          AND o.created_at < ((days.day + 1) AT TIME ZONE 'Asia/Tehran')
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
        WHERE created_at >= (${date}::date AT TIME ZONE 'Asia/Tehran')
          AND created_at < ((${date}::date + 1) AT TIME ZONE 'Asia/Tehran')
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
          COALESCE(SUM(subtotal_amount) FILTER (WHERE status = ${soldStatus}), 0)::float8 AS "foodSales"
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
  const row = todayRows[0]
  const today: AdminDashboardSummaryDto['today'] = row
    ? { ...row, date, isTodayMenuOpen: row.isTodayMenuOpen ?? false }
    : {
      date, totalOrders: 0, pendingOrders: 0, activeOrders: 0, deliveredOrders: 0,
      cancelledOrders: 0, totalPortions: 0, foodSales: 0, todayMenuItems: 0, isTodayMenuOpen: false,
    }
  return { today, month, monthDaily }
}
