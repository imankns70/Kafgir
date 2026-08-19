import { OrderStatus, type CustomerReportDto, type CustomerReportRowDto } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { averageOrderValue, averageOrdersPerCustomer } from '../domain/customer-report-rules'

/**
 * Who buys from Kafgir, how often, and how much.
 *
 * Range boundaries use `AT TIME ZONE 'Asia/Tehran'` exactly like the managerial report, so a day
 * means the same thing on both screens rather than drifting with the server's clock.
 *
 * Revenue counts delivered orders only and order counts exclude cancellations — see the contract in
 * `@kafgir/contracts/customer-report` for why.
 */

/** Bounds the ranked table so a large customer base cannot stall the desktop app over a slow link. */
const topCustomerLimit = 100

type ReportRow = Omit<CustomerReportRowDto, 'joinedAt' | 'lastOrderAt' | 'averageOrderValue'> & {
  joinedAt: Date | string
  lastOrderAt: Date | string | null
}

type SummaryRow = {
  totalCustomers: number
  newCustomers: number
  activeCustomers: number
  returningCustomers: number
  customersWithoutOrders: number
  totalRevenue: number
  rangeOrderCount: number
}

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()

export async function getCustomerReport(from: string, to: string): Promise<CustomerReportDto> {
  // One shared range expression keeps the summary and the ranking on identical boundaries.
  const rangeStart = sqlClient`(${from}::date AT TIME ZONE 'Asia/Tehran')`
  const rangeEnd = sqlClient`((${to}::date + 1) AT TIME ZONE 'Asia/Tehran')`

  const [summaryRows, customerRows] = await Promise.all([
    sqlClient<SummaryRow[]>`
      WITH range_orders AS (
        SELECT o.customer_profile_id, o.status, o.total_amount
        FROM orders o
        WHERE o.created_at >= ${rangeStart} AND o.created_at < ${rangeEnd}
      ),
      active AS (
        SELECT DISTINCT customer_profile_id FROM range_orders WHERE status <> ${OrderStatus.Cancelled}
      )
      SELECT
        (SELECT COUNT(*)::int FROM customer_profiles) AS "totalCustomers",
        (SELECT COUNT(*)::int FROM customer_profiles p
          WHERE p.created_at >= ${rangeStart} AND p.created_at < ${rangeEnd}) AS "newCustomers",
        (SELECT COUNT(*)::int FROM active) AS "activeCustomers",
        -- "Returning" means the customer had already ordered before this range opened.
        (SELECT COUNT(*)::int FROM active a WHERE EXISTS (
          SELECT 1 FROM orders o
          WHERE o.customer_profile_id = a.customer_profile_id
            AND o.status <> ${OrderStatus.Cancelled}
            AND o.created_at < ${rangeStart}
        )) AS "returningCustomers",
        (SELECT COUNT(*)::int FROM customer_profiles p WHERE NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.customer_profile_id = p.id AND o.status <> ${OrderStatus.Cancelled}
        )) AS "customersWithoutOrders",
        (SELECT COALESCE(SUM(total_amount), 0)::float8 FROM range_orders
          WHERE status = ${OrderStatus.Delivered}) AS "totalRevenue",
        (SELECT COUNT(*)::int FROM range_orders WHERE status <> ${OrderStatus.Cancelled})
          AS "rangeOrderCount"
    `,
    sqlClient<ReportRow[]>`
      SELECT p.id AS "customerProfileId", p.preferred_name AS "preferredName",
             COALESCE(NULLIF(p.default_phone_number, ''), u.phone_number, '') AS "phoneNumber",
             CASE WHEN t.user_id IS NULL THEN 'phone' ELSE 'telegram' END AS channel,
             p.created_at AS "joinedAt",
             COUNT(*) FILTER (WHERE o.status <> ${OrderStatus.Cancelled})::int AS "orderCount",
             COUNT(*) FILTER (WHERE o.status = ${OrderStatus.Delivered})::int AS "deliveredCount",
             COUNT(*) FILTER (WHERE o.status = ${OrderStatus.Cancelled})::int AS "cancelledCount",
             COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = ${OrderStatus.Delivered}), 0)::float8
               AS "totalSpent",
             MAX(o.created_at) FILTER (WHERE o.status <> ${OrderStatus.Cancelled}) AS "lastOrderAt"
      FROM customer_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN telegram_accounts t ON t.user_id = p.user_id
      JOIN orders o ON o.customer_profile_id = p.id
        AND o.created_at >= ${rangeStart} AND o.created_at < ${rangeEnd}
      GROUP BY p.id, u.phone_number, t.user_id
      -- A customer whose only orders in the range were cancelled is not a buyer worth ranking.
      HAVING COUNT(*) FILTER (WHERE o.status <> ${OrderStatus.Cancelled}) > 0
      ORDER BY "totalSpent" DESC, "orderCount" DESC, p.id
      LIMIT ${topCustomerLimit}
    `,
  ])

  const summary = summaryRows[0] ?? {
    totalCustomers: 0, newCustomers: 0, activeCustomers: 0, returningCustomers: 0,
    customersWithoutOrders: 0, totalRevenue: 0, rangeOrderCount: 0,
  }

  return {
    from,
    to,
    topCustomerLimit,
    summary: {
      totalCustomers: summary.totalCustomers,
      newCustomers: summary.newCustomers,
      activeCustomers: summary.activeCustomers,
      returningCustomers: summary.returningCustomers,
      customersWithoutOrders: summary.customersWithoutOrders,
      totalRevenue: summary.totalRevenue,
      averageOrderValue: averageOrderValue(summary.totalRevenue, summary.rangeOrderCount),
      averageOrdersPerActiveCustomer:
        averageOrdersPerCustomer(summary.rangeOrderCount, summary.activeCustomers),
    },
    topCustomers: customerRows.map((row) => ({
      customerProfileId: row.customerProfileId,
      preferredName: row.preferredName,
      phoneNumber: row.phoneNumber,
      channel: row.channel,
      joinedAt: iso(row.joinedAt),
      orderCount: row.orderCount,
      deliveredCount: row.deliveredCount,
      cancelledCount: row.cancelledCount,
      totalSpent: row.totalSpent,
      averageOrderValue: averageOrderValue(row.totalSpent, row.deliveredCount),
      lastOrderAt: row.lastOrderAt == null ? null : iso(row.lastOrderAt),
    })),
  }
}
