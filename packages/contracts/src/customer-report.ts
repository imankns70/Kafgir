import { z } from 'zod'
import { isoDate } from './delivery.js'

/**
 * The customer report answers "who buys from Kafgir, how often, and how much".
 *
 * Two money rules are deliberate and the UI states them, because a report whose numbers cannot be
 * reconciled with the finance screens is worse than no report:
 *
 * - Revenue counts **delivered** orders only. A pending or preparing order is not money earned, and
 *   counting it would inflate a customer's lifetime value against an order that may still cancel.
 * - Order counts exclude cancelled orders, which are reported in their own column so a customer with
 *   a high cancellation rate is visible rather than hidden.
 */

/** How the customer reaches Kafgir. Derived from whether a Telegram account is linked. */
export const customerChannelSchema = z.enum(['telegram', 'phone'])

export const customerReportRowSchema = z.object({
  customerProfileId: z.number().int().positive(),
  preferredName: z.string(),
  phoneNumber: z.string(),
  channel: customerChannelSchema,
  joinedAt: z.string(),
  /** Non-cancelled orders created inside the selected range. */
  orderCount: z.number().int().nonnegative(),
  deliveredCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  /** Sum of `total_amount` across delivered orders in the range. */
  totalSpent: z.number().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
  lastOrderAt: z.string().nullable(),
})

export const customerReportSummarySchema = z.object({
  /** Customer profiles that exist at all, regardless of the range. */
  totalCustomers: z.number().int().nonnegative(),
  /** Profiles created inside the range. */
  newCustomers: z.number().int().nonnegative(),
  /** Profiles with at least one non-cancelled order inside the range. */
  activeCustomers: z.number().int().nonnegative(),
  /** Active customers whose first ever order predates the range — they came back. */
  returningCustomers: z.number().int().nonnegative(),
  /** Profiles that have never placed a non-cancelled order, at any time. */
  customersWithoutOrders: z.number().int().nonnegative(),
  /** Delivered revenue inside the range. */
  totalRevenue: z.number().nonnegative(),
  averageOrderValue: z.number().nonnegative(),
  averageOrdersPerActiveCustomer: z.number().nonnegative(),
})

export const customerReportSchema = z.object({
  from: isoDate,
  to: isoDate,
  summary: customerReportSummarySchema,
  /** Ranked by delivered spend. Bounded so a large customer base cannot stall the desktop app. */
  topCustomers: z.array(customerReportRowSchema),
  /** How many rows the ranking was limited to, so the UI can say the list is partial. */
  topCustomerLimit: z.number().int().positive(),
})

export const customerReportQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
})

export type CustomerChannel = z.infer<typeof customerChannelSchema>
export type CustomerReportRowDto = z.infer<typeof customerReportRowSchema>
export type CustomerReportSummaryDto = z.infer<typeof customerReportSummarySchema>
export type CustomerReportDto = z.infer<typeof customerReportSchema>
export type CustomerReportQuery = z.infer<typeof customerReportQuerySchema>
