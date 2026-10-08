import { sqlClient } from './client'

/**
 * The day an order is cooked and handed over: its delivery date, or the Tehran day it was placed when
 * it has none (pickup, and orders from before delivery dates existed). The kitchen, the dashboard and
 * the month reports all group by it, so an order placed last night for today counts as today's work.
 *
 * Kept as one expression so every query matches `orders_service_date_idx` exactly.
 */
export const orderServiceDate = (alias = 'orders') =>
  sqlClient.unsafe(`COALESCE(${alias}.delivery_date, (${alias}.created_at AT TIME ZONE 'Asia/Tehran')::date)`)
