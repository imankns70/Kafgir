import type { AdminDashboardSummaryDto } from '@kafgir/contracts'
import { OrderStatus } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { businessDate } from '../time'

export async function getDashboard(): Promise<AdminDashboardSummaryDto> {
  const date = businessDate()
  const rows = await sqlClient<Array<Omit<AdminDashboardSummaryDto, 'date' | 'isTodayMenuOpen'> & {
    isTodayMenuOpen: boolean | null
  }>>`
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
        COUNT(*) FILTER (WHERE status = ${OrderStatus.Confirmed})::int AS "confirmedOrders",
        COUNT(*) FILTER (WHERE status = ${OrderStatus.Preparing})::int AS "preparingOrders",
        COUNT(*) FILTER (WHERE status = ${OrderStatus.Ready})::int AS "readyOrders",
        COUNT(*) FILTER (WHERE status = ${OrderStatus.Delivered})::int AS "deliveredOrders",
        COUNT(*) FILTER (WHERE status = ${OrderStatus.Cancelled})::int AS "cancelledOrders",
        COUNT(*) FILTER (WHERE status IN (${OrderStatus.Confirmed}, ${OrderStatus.Preparing}, ${OrderStatus.Ready}))::int AS "activeOrders",
        COALESCE(SUM(total_amount) FILTER (WHERE status <> ${OrderStatus.Cancelled}), 0)::float8 AS "grossSales",
        COALESCE(SUM(total_amount) FILTER (WHERE status = ${OrderStatus.Confirmed}), 0)::float8 AS "confirmedSales",
        COALESCE(SUM(total_amount) FILTER (WHERE status = ${OrderStatus.Delivered}), 0)::float8 AS "deliveredSales"
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
      (SELECT COUNT(*)::int FROM daily_menu_items dmi JOIN daily_menus dm ON dm.id = dmi.daily_menu_id WHERE dm.menu_date = ${date}::date) AS "todayMenuItems",
      (SELECT is_open FROM daily_menus WHERE menu_date = ${date}::date LIMIT 1) AS "isTodayMenuOpen"
    FROM order_stats
    CROSS JOIN portion_stats
  `
  const empty: AdminDashboardSummaryDto = {
    date,
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    activeOrders: 0,
    totalPortions: 0,
    grossSales: 0,
    confirmedSales: 0,
    deliveredSales: 0,
    todayMenuItems: 0,
    isTodayMenuOpen: false,
  }
  return rows[0] ? { ...rows[0], date, isTodayMenuOpen: rows[0].isTodayMenuOpen ?? false } : empty
}
