import { z } from 'zod'
import { isoDate } from './delivery.js'

/**
 * Couriers, their per-day rate, and what the business owes them.
 *
 * Two monetary values live side by side here and are deliberately never merged:
 *
 * - `customerDeliveryFee` is what the customer is charged. It reaches the customer's cart, the
 *   invoice and `orders.delivery_fee`.
 * - `courierPayablePerOrder` is what the courier earns per successfully delivered order. It is
 *   internal accounting and must never appear in a customer-facing DTO.
 *
 * They start out equal in practice, but charging 50,000 while paying 70,000 — or subsidising
 * delivery entirely — must not require a schema change, so they are separate columns from day one.
 */

/** Toman, integer. The UI never shows fractions of a Toman and the database never stores them. */
export const tomanAmount = z.number()
  .int('مبلغ باید عددی صحیح به تومان باشد.')
  .nonnegative('مبلغ نمی‌تواند منفی باشد.')
  .max(1_000_000_000, 'مبلغ واردشده بیش از حد بزرگ است.')

export const courierSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string(),
  mobile: z.string(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export const courierWriteSchema = z.object({
  fullName: z.string().trim().min(1, 'نام پیک الزامی است.').max(150),
  mobile: z.string().trim().min(1, 'شماره موبایل پیک الزامی است.').max(30),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
})

/**
 * One day's courier arrangement. For the first version a date has at most one *active* configuration,
 * enforced by a partial unique index rather than by application code.
 *
 * Editing this row changes nothing about orders already placed: every order carries its own snapshot.
 */
export const courierDeliveryDaySchema = z.object({
  id: z.number().int().positive(),
  deliveryDate: isoDate,
  courierId: z.number().int().positive(),
  courierFullName: z.string(),
  courierMobile: z.string(),
  customerDeliveryFee: tomanAmount,
  courierPayablePerOrder: tomanAmount,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export const courierDeliveryDayWriteSchema = z.object({
  deliveryDate: isoDate,
  courierId: z.number().int().positive('انتخاب پیک الزامی است.'),
  customerDeliveryFee: tomanAmount,
  courierPayablePerOrder: tomanAmount,
  isActive: z.boolean().default(true),
})

/** Admin's view of one date: the active configuration when one exists, plus how many orders used it. */
export const courierDeliveryDayViewSchema = z.object({
  deliveryDate: isoDate,
  configuration: courierDeliveryDaySchema.nullable(),
  /** Orders already snapshotted against this date's courier. Explains why editing changes nothing. */
  snapshottedOrders: z.number().int().nonnegative(),
})

export const courierSettlementSchema = z.object({
  id: z.number().int().positive(),
  courierId: z.number().int().positive(),
  amount: tomanAmount,
  settledAt: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

export const courierSettlementWriteSchema = z.object({
  courierId: z.number().int().positive(),
  amount: tomanAmount.refine((value) => value > 0, 'مبلغ تسویه باید بیشتر از صفر باشد.'),
  note: z.string().trim().max(1000).nullable().optional(),
})

/**
 * Courier accounting, always computed server-side from order snapshots and settlement rows. Nothing
 * here is stored as a running balance, so a settlement can never silently rewrite past earnings.
 */
export const courierAccountSummarySchema = z.object({
  courierId: z.number().int().positive(),
  fullName: z.string(),
  mobile: z.string(),
  isActive: z.boolean(),
  /** Orders whose current status is Delivered and that carry a courier payable snapshot. */
  deliveredOrders: z.number().int().nonnegative(),
  earnedAmount: z.number().nonnegative(),
  settledAmount: z.number().nonnegative(),
  outstandingAmount: z.number(),
})

export type CourierDto = z.infer<typeof courierSchema>
export type CourierWriteRequest = z.infer<typeof courierWriteSchema>
export type CourierDeliveryDayDto = z.infer<typeof courierDeliveryDaySchema>
export type CourierDeliveryDayWriteRequest = z.infer<typeof courierDeliveryDayWriteSchema>
export type CourierDeliveryDayViewDto = z.infer<typeof courierDeliveryDayViewSchema>
export type CourierSettlementDto = z.infer<typeof courierSettlementSchema>
export type CourierSettlementWriteRequest = z.infer<typeof courierSettlementWriteSchema>
export type CourierAccountSummaryDto = z.infer<typeof courierAccountSummarySchema>
