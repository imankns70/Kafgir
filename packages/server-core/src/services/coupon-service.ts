import {
  CouponDiscountType,
  OrderStatus,
  couponDiscount,
  normalizeCouponCode,
  type CouponCheckResultDto,
  type CouponDto,
  type CouponWriteRequest,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { formatToman } from '../domain/money'
import { logger } from '../logging/logger'
import { businessDate } from '../time'

/**
 * Discount codes.
 *
 * A coupon only ever comes off the food — never the delivery charge, which is a courier's money — and
 * the order stores the code and the amount it was given, so editing or retiring a coupon later cannot
 * change what an old order cost. Usage counts ignore cancelled orders: a cancelled order did not use
 * the offer up.
 */

type CouponRow = Omit<CouponDto, 'createdAt'> & { createdAt: Date | string; normalizedCode: string }

const selectCoupons = (where: ReturnType<typeof sqlClient.unsafe>) => sqlClient<CouponRow[]>`
  SELECT c.id, c.code, c.normalized_code AS "normalizedCode", c.title,
         c.discount_type AS "discountType", c.discount_value::float8 AS "discountValue",
         c.max_discount_amount::float8 AS "maxDiscountAmount", c.min_order_amount::float8 AS "minOrderAmount",
         c.starts_on::text AS "startsOn", c.ends_on::text AS "endsOn",
         c.usage_limit AS "usageLimit", c.per_customer_limit AS "perCustomerLimit",
         c.first_order_only AS "firstOrderOnly", c.is_active AS "isActive", c.created_at AS "createdAt",
         COUNT(o.id)::int AS "timesUsed", COALESCE(SUM(o.discount_amount), 0)::float8 AS "totalDiscount"
  FROM coupons c
  LEFT JOIN orders o ON o.coupon_id = c.id AND o.status <> ${OrderStatus.Cancelled}
  ${where}
  GROUP BY c.id
  ORDER BY c.is_active DESC, c.created_at DESC
`

const dto = ({ normalizedCode: _normalized, ...row }: CouponRow): CouponDto => ({
  ...row,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
})

export async function listCoupons(): Promise<CouponDto[]> {
  return (await selectCoupons(sqlClient.unsafe(''))).map(dto)
}

async function getCoupon(id: number): Promise<CouponDto> {
  const rows = await selectCoupons(sqlClient.unsafe(`WHERE c.id = ${Number(id)}`))
  if (!rows[0]) throw new NotFoundError('کد تخفیف پیدا نشد.')
  return dto(rows[0])
}

const values = (input: CouponWriteRequest) => ({
  code: input.code.trim().toUpperCase(),
  normalizedCode: normalizeCouponCode(input.code),
  title: input.title?.trim() || null,
  discountType: input.discountType,
  discountValue: input.discountValue,
  maxDiscountAmount: input.discountType === CouponDiscountType.Percent ? input.maxDiscountAmount ?? null : null,
  minOrderAmount: input.minOrderAmount ?? 0,
  startsOn: input.startsOn ?? null,
  endsOn: input.endsOn ?? null,
  usageLimit: input.usageLimit ?? null,
  perCustomerLimit: input.perCustomerLimit ?? null,
  firstOrderOnly: input.firstOrderOnly ?? false,
  isActive: input.isActive ?? true,
})

const duplicate = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505'

async function audit(action: string, id: number, userId: number, details: string | null) {
  await sqlClient`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES (${action}, 'coupon', ${id}, ${userId}, ${details}, NOW())`
  logger.info({ event: action, entityType: 'coupon', entityId: id, userId }, 'کد تخفیف ثبت شد')
}

export async function createCoupon(input: CouponWriteRequest, userId: number): Promise<CouponDto> {
  const v = values(input)
  try {
    const rows = await sqlClient<{ id: number }[]>`
      INSERT INTO coupons (code, normalized_code, title, discount_type, discount_value, max_discount_amount,
        min_order_amount, starts_on, ends_on, usage_limit, per_customer_limit, first_order_only, is_active, created_at)
      VALUES (${v.code}, ${v.normalizedCode}, ${v.title}, ${v.discountType}, ${v.discountValue}, ${v.maxDiscountAmount},
        ${v.minOrderAmount}, ${v.startsOn}, ${v.endsOn}, ${v.usageLimit}, ${v.perCustomerLimit}, ${v.firstOrderOnly},
        ${v.isActive}, NOW())
      RETURNING id`
    await audit('coupon.create', rows[0]!.id, userId, v.code)
    return getCoupon(rows[0]!.id)
  } catch (error) {
    if (duplicate(error)) throw new AppError('این کد تخفیف قبلاً ساخته شده است.')
    throw error
  }
}

export async function updateCoupon(id: number, input: CouponWriteRequest, userId: number): Promise<CouponDto> {
  const v = values(input)
  try {
    const rows = await sqlClient<{ id: number }[]>`
      UPDATE coupons SET code = ${v.code}, normalized_code = ${v.normalizedCode}, title = ${v.title},
        discount_type = ${v.discountType}, discount_value = ${v.discountValue}, max_discount_amount = ${v.maxDiscountAmount},
        min_order_amount = ${v.minOrderAmount}, starts_on = ${v.startsOn}, ends_on = ${v.endsOn},
        usage_limit = ${v.usageLimit}, per_customer_limit = ${v.perCustomerLimit},
        first_order_only = ${v.firstOrderOnly}, is_active = ${v.isActive}, updated_at = NOW()
      WHERE id = ${id} RETURNING id`
    if (!rows[0]) throw new NotFoundError('کد تخفیف پیدا نشد.')
    await audit('coupon.update', id, userId, v.code)
    return getCoupon(id)
  } catch (error) {
    if (duplicate(error)) throw new AppError('این کد تخفیف قبلاً ساخته شده است.')
    throw error
  }
}

/** A coupon that was used is kept for the orders that point at it; it can only be switched off. */
export async function deleteCoupon(id: number, userId: number): Promise<void> {
  const used = await sqlClient<{ value: boolean }[]>`SELECT EXISTS(SELECT 1 FROM orders WHERE coupon_id = ${id}) AS value`
  if (used[0]?.value) throw new AppError('این کد در سفارش‌ها استفاده شده و حذف نمی‌شود؛ آن را غیرفعال کنید.')
  const rows = await sqlClient<{ code: string }[]>`DELETE FROM coupons WHERE id = ${id} RETURNING code`
  if (!rows[0]) throw new NotFoundError('کد تخفیف پیدا نشد.')
  await audit('coupon.delete', id, userId, rows[0].code)
}

type EligibilityRow = {
  id: number
  code: string
  title: string | null
  discountType: CouponDiscountType
  discountValue: number
  maxDiscountAmount: number | null
  minOrderAmount: number
  startsOn: string | null
  endsOn: string | null
  usageLimit: number | null
  perCustomerLimit: number | null
  firstOrderOnly: boolean
  isActive: boolean
}

type Sql = TransactionSql | typeof sqlClient

async function findCoupon(sql: Sql, code: string, lock: boolean): Promise<EligibilityRow> {
  const normalized = normalizeCouponCode(code)
  const rows = await sql<EligibilityRow[]>`
    SELECT id, code, title, discount_type AS "discountType", discount_value::float8 AS "discountValue",
           max_discount_amount::float8 AS "maxDiscountAmount", min_order_amount::float8 AS "minOrderAmount",
           starts_on::text AS "startsOn", ends_on::text AS "endsOn", usage_limit AS "usageLimit",
           per_customer_limit AS "perCustomerLimit", first_order_only AS "firstOrderOnly", is_active AS "isActive"
    FROM coupons WHERE normalized_code = ${normalized}
    ${lock ? sql`FOR UPDATE` : sql``}`
  const coupon = rows[0]
  if (!coupon || !coupon.isActive) throw new AppError('این کد تخفیف معتبر نیست.')
  const today = businessDate()
  if (coupon.startsOn && today < coupon.startsOn) throw new AppError('این کد تخفیف هنوز فعال نشده است.')
  if (coupon.endsOn && today > coupon.endsOn) throw new AppError('مهلت استفاده از این کد تخفیف تمام شده است.')
  return coupon
}

const amountFor = (coupon: EligibilityRow, subtotal: number) => {
  if (subtotal < coupon.minOrderAmount) {
    throw new AppError(`این کد برای سفارش‌های از ${formatToman(coupon.minOrderAmount)} به بالا است.`)
  }
  const discount = couponDiscount(coupon, subtotal)
  if (discount <= 0) throw new AppError('این کد تخفیف روی این سفارش اثری ندارد.')
  return discount
}

async function assertUsageLeft(sql: Sql, coupon: EligibilityRow, customerProfileId: number | null) {
  const usage = await sql<{ total: number; mine: number; myOrders: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM orders WHERE coupon_id = ${coupon.id} AND status <> ${OrderStatus.Cancelled}) AS total,
      (SELECT COUNT(*)::int FROM orders WHERE coupon_id = ${coupon.id} AND status <> ${OrderStatus.Cancelled}
         AND customer_profile_id = ${customerProfileId}) AS mine,
      (SELECT COUNT(*)::int FROM orders WHERE customer_profile_id = ${customerProfileId}
         AND status <> ${OrderStatus.Cancelled}) AS "myOrders"`
  const { total = 0, mine = 0, myOrders = 0 } = usage[0] ?? {}
  if (coupon.usageLimit != null && total >= coupon.usageLimit) throw new AppError('ظرفیت این کد تخفیف تمام شده است.')
  if (customerProfileId == null) return
  if (coupon.perCustomerLimit != null && mine >= coupon.perCustomerLimit) {
    throw new AppError('شما پیش‌تر از این کد تخفیف استفاده کرده‌اید.')
  }
  if (coupon.firstOrderOnly && myOrders > 0) throw new AppError('این کد فقط برای اولین سفارش است.')
}

/**
 * The coupon an order is about to use, checked and priced inside the order's transaction. The row is
 * locked so two checkouts cannot both take the last use of a limited code.
 */
export async function applyCouponToOrder(
  tx: TransactionSql,
  code: string,
  customerProfileId: number,
  subtotal: number,
): Promise<{ id: number; code: string; discount: number }> {
  const coupon = await findCoupon(tx, code, true)
  await assertUsageLeft(tx, coupon, customerProfileId)
  return { id: coupon.id, code: coupon.code, discount: amountFor(coupon, subtotal) }
}

/** The discount an existing order's coupon gives on a new subtotal, for order corrections. */
export async function recomputeOrderDiscount(tx: TransactionSql, couponId: number | null, subtotal: number): Promise<number> {
  if (couponId == null) return 0
  const rows = await tx<EligibilityRow[]>`
    SELECT discount_type AS "discountType", discount_value::float8 AS "discountValue",
           max_discount_amount::float8 AS "maxDiscountAmount", min_order_amount::float8 AS "minOrderAmount"
    FROM coupons WHERE id = ${couponId}`
  return rows[0] ? couponDiscount(rows[0], subtotal) : 0
}

/** The checkout preview. Per-customer rules are checked again when the order is placed. */
export async function checkCoupon(code: string, subtotal: number, customerProfileId: number | null = null): Promise<CouponCheckResultDto> {
  const coupon = await findCoupon(sqlClient, code, false)
  await assertUsageLeft(sqlClient, coupon, customerProfileId)
  const discountAmount = amountFor(coupon, subtotal)
  return {
    code: coupon.code,
    title: coupon.title,
    discountAmount,
    message: `${formatToman(discountAmount)} از مبلغ غذا کم می‌شود.`,
  }
}

/** The checkout preview for a signed-in user, or for a guest when `userId` is null. */
export async function checkCouponForUser(code: string, subtotal: number, userId: number | null): Promise<CouponCheckResultDto> {
  const profiles = userId == null ? [] : await sqlClient<{ id: number }[]>`
    SELECT id FROM customer_profiles WHERE user_id = ${userId} LIMIT 1`
  return checkCoupon(code, subtotal, profiles[0]?.id ?? null)
}
