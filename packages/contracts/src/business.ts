import { z } from 'zod'
import { isoDate } from './delivery.js'
import { tomanAmount } from './courier.js'

/**
 * Kafgir's business view, deliberately small.
 *
 * The kitchen needs to know two things about a month: what came in from selling food, and what went
 * out buying supplies. Everything else — stock ledgers, weighted costing, account balances, purchase
 * payment workflows — was machinery for a finance system nobody here has time to operate.
 *
 * A purchase is one line: a date, an amount and a few words. It is not itemised, because itemising
 * it is how the old model became unusable.
 */

/** Jalali month names in order, index 0 = فروردین. Shared so every screen names a month identically. */
export const persianMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

/** «مرداد ۱۴۰۵». `month` is 1-based. */
export const jalaliMonthTitle = (year: number, month: number): string =>
  `${persianMonthNames[month - 1] ?? ''} ${year}`

export const jalaliMonthSchema = z.object({
  year: z.number().int().min(1300).max(1500),
  month: z.number().int().min(1).max(12),
})

export const purchaseWriteSchema = z.object({
  purchaseDate: isoDate,
  amount: tomanAmount.refine((value) => value > 0, 'مبلغ خرید باید بیشتر از صفر باشد.'),
  title: z.string().trim().min(1, 'عنوان خرید الزامی است.').max(200),
  sellerName: z.string().trim().max(150).nullable().optional(),
  receiptImageUrl: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export const purchaseSchema = purchaseWriteSchema.extend({
  id: z.number().int().positive(),
  sellerName: z.string().nullable(),
  receiptImageUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export const monthPurchasesSchema = jalaliMonthSchema.extend({
  title: z.string(),
  /** Half-open ISO range the month covers, so the UI can state what it is showing. */
  fromDate: isoDate,
  toDate: isoDate,
  purchases: z.array(purchaseSchema),
  totalAmount: z.number().nonnegative(),
})

/**
 * One month's picture.
 *
 * `salesMinusPurchases` is exactly that and is never called profit: salaries, rent, utilities,
 * packaging and courier pay are not all inside it, so naming it profit would be a lie a kitchen
 * operator has no way to catch.
 */
export const monthlySummarySchema = jalaliMonthSchema.extend({
  title: z.string(),
  fromDate: isoDate,
  toDate: isoDate,
  /** Sum of order subtotals — food only, never the customer's delivery charge. */
  foodSales: z.number().nonnegative(),
  purchases: z.number().nonnegative(),
  salesMinusPurchases: z.number(),
  /** Purchases as a percentage of food sales. Null when the month sold nothing. */
  purchaseToSalesPercent: z.number().nullable(),
  /** What the couriers earned that month. Reported beside the comparison, never inside it. */
  courierCost: z.number().nonnegative(),
  purchaseCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
})

/** One row per calendar day of the month, for the trend. Days with no activity are present as zeros. */
export const monthlyDailyPointSchema = z.object({
  date: isoDate,
  dayOfMonth: z.number().int().min(1).max(31),
  foodSales: z.number().nonnegative(),
  purchases: z.number().nonnegative(),
})

export const monthlyReportSchema = z.object({
  summary: monthlySummarySchema,
  daily: z.array(monthlyDailyPointSchema),
})

export const monthListItemSchema = monthlySummarySchema.pick({
  year: true, month: true, title: true, foodSales: true, purchases: true,
  salesMinusPurchases: true, purchaseToSalesPercent: true,
})

export type PurchaseDto = z.infer<typeof purchaseSchema>
export type PurchaseWriteRequest = z.infer<typeof purchaseWriteSchema>
export type MonthPurchasesDto = z.infer<typeof monthPurchasesSchema>
export type JalaliMonthRef = z.infer<typeof jalaliMonthSchema>
export type MonthlySummaryDto = z.infer<typeof monthlySummarySchema>
export type MonthlyDailyPointDto = z.infer<typeof monthlyDailyPointSchema>
export type MonthlyReportDto = z.infer<typeof monthlyReportSchema>
export type MonthListItemDto = z.infer<typeof monthListItemSchema>
