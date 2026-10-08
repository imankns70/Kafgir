import { z } from 'zod'
import { isoDate } from './delivery.js'

/** 1: a percentage of the food subtotal; 2: a fixed toman amount off the food. */
export enum CouponDiscountType {
  Percent = 1,
  Fixed = 2,
}

/** Codes are matched case-insensitively and without spaces or dashes, Persian digits folded. */
export function normalizeCouponCode(code: string): string {
  return code
    .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s\-_]/gu, '')
    .toUpperCase()
}

/**
 * What a coupon takes off a food subtotal, before any eligibility check: a percentage capped by
 * `maxDiscountAmount`, or a fixed amount, never more than the food itself. Whole tomans only.
 */
export function couponDiscount(
  coupon: { discountType: CouponDiscountType; discountValue: number; maxDiscountAmount: number | null; minOrderAmount: number },
  subtotal: number,
): number {
  if (subtotal <= 0 || subtotal < coupon.minOrderAmount) return 0
  const raw = coupon.discountType === CouponDiscountType.Percent
    ? Math.floor((subtotal * coupon.discountValue) / 100)
    : coupon.discountValue
  const capped = coupon.maxDiscountAmount == null ? raw : Math.min(raw, coupon.maxDiscountAmount)
  return Math.max(0, Math.min(subtotal, Math.round(capped)))
}

export const couponWriteSchema = z.object({
  code: z.string().trim().min(3, 'کد دست‌کم ۳ نویسه است.').max(40)
    .refine((code) => /^[A-Za-z0-9۰-۹\-_ ]+$/u.test(code), 'کد فقط حروف انگلیسی، عدد و خط تیره دارد.'),
  title: z.string().trim().max(150).nullable().optional(),
  discountType: z.nativeEnum(CouponDiscountType),
  discountValue: z.number().positive('مقدار تخفیف باید بیشتر از صفر باشد.'),
  maxDiscountAmount: z.number().positive().nullable().optional(),
  minOrderAmount: z.number().min(0).default(0),
  startsOn: isoDate.nullable().optional(),
  endsOn: isoDate.nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().nullable().optional(),
  firstOrderOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).refine((value) => value.discountType !== CouponDiscountType.Percent || value.discountValue <= 100, {
  message: 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.', path: ['discountValue'],
}).refine((value) => !value.startsOn || !value.endsOn || value.startsOn <= value.endsOn, {
  message: 'تاریخ پایان باید پس از تاریخ شروع باشد.', path: ['endsOn'],
})

export const couponSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  title: z.string().nullable(),
  discountType: z.nativeEnum(CouponDiscountType),
  discountValue: z.number(),
  maxDiscountAmount: z.number().nullable(),
  minOrderAmount: z.number(),
  startsOn: isoDate.nullable(),
  endsOn: isoDate.nullable(),
  usageLimit: z.number().int().nullable(),
  perCustomerLimit: z.number().int().nullable(),
  firstOrderOnly: z.boolean(),
  isActive: z.boolean(),
  /** Non-cancelled orders that used the code, and the food money they were given off. */
  timesUsed: z.number().int().nonnegative(),
  totalDiscount: z.number().nonnegative(),
  createdAt: z.string(),
})

/** The customer's preview while checking out; the order itself re-checks everything. */
export const couponCheckSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().min(0),
})

export const couponCheckResultSchema = z.object({
  code: z.string(),
  title: z.string().nullable(),
  discountAmount: z.number().nonnegative(),
  message: z.string(),
})

export type CouponWriteRequest = z.infer<typeof couponWriteSchema>
export type CouponDto = z.infer<typeof couponSchema>
export type CouponCheckRequest = z.infer<typeof couponCheckSchema>
export type CouponCheckResultDto = z.infer<typeof couponCheckResultSchema>
