import type {
  CourierAccountSummaryDto,
  CourierDeliveryDayDto,
  CourierDeliveryDayViewDto,
  CourierDeliveryDayWriteRequest,
  CourierDto,
  CourierSettlementDto,
  CourierSettlementWriteRequest,
  CourierWriteRequest,
  DeliveryPricingDto,
} from '@kafgir/contracts'
import { OrderStatus } from '@kafgir/contracts'
import type { Sql, TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import {
  courierDayMissingMessage,
  courierOutstanding,
  effectiveCustomerDeliveryFee,
  settlementRejection,
  type CourierDayPricing,
} from '../domain/courier-rules'
import { optionalText } from '../domain/order-rules'

type Tx = TransactionSql<Record<string, unknown>>
type Queryable = Sql<Record<string, unknown>> | Tx

type DbTimestamp = Date | string
const iso = (value: DbTimestamp) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIso = (value: DbTimestamp | null) => (value ? iso(value) : null)

/**
 * Serialises everything that reads or writes one date's courier arrangement.
 *
 * The lock matters because a save is two statements — retire the current row, insert the new one —
 * while a checkout reads the active row. Without it a checkout landing between the two statements
 * would see no configuration on a day that has one, and a checkout landing after a partial change
 * could mix an old courier with a new rate. Both callers take the same transaction-scoped advisory
 * lock, mirroring the pattern already used for delivery-window capacity and order numbering.
 */
const lockCourierDay = (tx: Tx, deliveryDate: string) =>
  tx`SELECT pg_advisory_xact_lock(hashtext(${`kafgir-courier-day-${deliveryDate}`}))`

type CourierRow = Omit<CourierDto, 'createdAt' | 'updatedAt'> & {
  createdAt: DbTimestamp
  updatedAt: DbTimestamp | null
}

const courierDto = (row: CourierRow): CourierDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: nullableIso(row.updatedAt),
})

export async function listCouriers(includeInactive = true): Promise<CourierDto[]> {
  const rows = await sqlClient<CourierRow[]>`
    SELECT id, full_name AS "fullName", mobile, is_active AS "isActive", notes,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM couriers
    WHERE ${includeInactive} OR is_active = true
    ORDER BY is_active DESC, full_name, id
  `
  return rows.map(courierDto)
}

const duplicateMobile = (error: unknown) => String(error).includes('couriers_mobile_uidx')

export async function createCourier(input: CourierWriteRequest): Promise<CourierDto> {
  try {
    const rows = await sqlClient<CourierRow[]>`
      INSERT INTO couriers (full_name, mobile, is_active, notes, created_at)
      VALUES (${input.fullName}, ${input.mobile}, ${input.isActive},
              ${optionalText(input.notes)}, NOW())
      RETURNING id, full_name AS "fullName", mobile, is_active AS "isActive", notes,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return courierDto(rows[0]!)
  } catch (error) {
    if (duplicateMobile(error)) throw new AppError('پیکی با این شماره موبایل قبلاً ثبت شده است.')
    throw error
  }
}

export async function updateCourier(id: number, input: CourierWriteRequest): Promise<CourierDto> {
  try {
    const rows = await sqlClient<CourierRow[]>`
      UPDATE couriers
      SET full_name = ${input.fullName}, mobile = ${input.mobile}, is_active = ${input.isActive},
          notes = ${optionalText(input.notes)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, full_name AS "fullName", mobile, is_active AS "isActive", notes,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    if (!rows[0]) throw new NotFoundError('پیک پیدا نشد.')
    return courierDto(rows[0])
  } catch (error) {
    if (duplicateMobile(error)) throw new AppError('پیکی با این شماره موبایل قبلاً ثبت شده است.')
    throw error
  }
}

/**
 * Deactivation is not deletion. Orders keep pointing at the courier, their payable snapshots keep
 * counting, and any outstanding balance stays payable — a courier who stops working is still owed
 * whatever was already earned.
 */
export async function setCourierActive(id: number, isActive: boolean): Promise<void> {
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE couriers SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id} RETURNING id
  `
  if (!rows[0]) throw new NotFoundError('پیک پیدا نشد.')
}

type CourierDayRow = {
  id: number
  deliveryDate: string
  courierId: number
  courierFullName: string
  courierMobile: string
  customerDeliveryFee: number
  courierPayablePerOrder: number
  isActive: boolean
  createdAt: DbTimestamp
  updatedAt: DbTimestamp | null
}

const courierDayDto = (row: CourierDayRow): CourierDeliveryDayDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: nullableIso(row.updatedAt),
})

/** The active configuration for one date, or null. Used by checkout, order creation and Admin. */
async function selectActiveCourierDay(
  tx: Queryable,
  deliveryDate: string,
): Promise<CourierDayRow | null> {
  const rows = await tx<CourierDayRow[]>`
    SELECT d.id, d.delivery_date::text AS "deliveryDate", d.courier_id AS "courierId",
           c.full_name AS "courierFullName", c.mobile AS "courierMobile",
           d.customer_delivery_fee::float8 AS "customerDeliveryFee",
           d.courier_payable_per_order::float8 AS "courierPayablePerOrder",
           d.is_active AS "isActive", d.created_at AS "createdAt", d.updated_at AS "updatedAt"
    FROM courier_delivery_days d
    JOIN couriers c ON c.id = d.courier_id
    WHERE d.delivery_date = ${deliveryDate} AND d.is_active
    LIMIT 1
  `
  return rows[0] ?? null
}

const toPricing = (row: CourierDayRow): CourierDayPricing => ({
  courierDeliveryDayId: row.id,
  courierId: row.courierId,
  courierName: row.courierFullName,
  customerDeliveryFee: row.customerDeliveryFee,
  courierPayablePerOrder: row.courierPayablePerOrder,
})

/**
 * Reads the courier arrangement for a delivery date inside an in-flight order transaction and
 * returns exactly what the order must snapshot.
 *
 * The whole point is that courier, customer fee and courier payable come from **one** row read once
 * under the day lock. Reading them separately, or re-reading between statements, is what would let
 * an order end up with yesterday's courier and today's rate.
 */
export async function reserveCourierDay(
  tx: Tx,
  deliveryDate: string,
): Promise<CourierDayPricing> {
  await lockCourierDay(tx, deliveryDate)
  const row = await selectActiveCourierDay(tx, deliveryDate)
  if (!row) throw new AppError(courierDayMissingMessage)
  return toPricing(row)
}

/**
 * Customer-facing delivery pricing for one date.
 *
 * The response is built field by field and carries the customer charge only. The courier payable is
 * never spread into it, and `DeliveryPricingDto` has no field that could hold it.
 */
export async function getDeliveryPricing(deliveryDate: string): Promise<DeliveryPricingDto> {
  const [methods, courierDay] = await Promise.all([
    sqlClient<{ method: number; requiresCourier: boolean; deliveryFee: number }[]>`
      SELECT method, requires_courier AS "requiresCourier", delivery_fee::float8 AS "deliveryFee"
      FROM delivery_method_settings
      WHERE is_customer_enabled
      ORDER BY display_order, method
    `,
    selectActiveCourierDay(sqlClient, deliveryDate),
  ])
  const pricing = courierDay ? toPricing(courierDay) : null
  return {
    deliveryDate,
    methods: methods.map((row) => {
      const fee = effectiveCustomerDeliveryFee({
        requiresCourier: row.requiresCourier,
        methodDeliveryFee: row.deliveryFee,
        courierDay: pricing,
      })
      return {
        method: row.method,
        requiresCourier: row.requiresCourier,
        customerDeliveryFee: fee,
        unavailableMessage: fee === null ? courierDayMissingMessage : null,
      }
    }),
  }
}

/** Admin's per-day view: the active configuration plus how many orders already froze it. */
export async function getCourierDeliveryDay(deliveryDate: string): Promise<CourierDeliveryDayViewDto> {
  const row = await selectActiveCourierDay(sqlClient, deliveryDate)
  const counts = await sqlClient<{ value: number }[]>`
    SELECT COUNT(*)::int AS value
    FROM orders o
    JOIN courier_delivery_days d ON d.id = o.courier_delivery_day_id
    WHERE d.delivery_date = ${deliveryDate}
  `
  return {
    deliveryDate,
    configuration: row ? courierDayDto(row) : null,
    snapshottedOrders: counts[0]?.value ?? 0,
  }
}

/**
 * Saves one date's arrangement.
 *
 * A change retires the current row and inserts a new one rather than updating in place, because
 * orders reference the configuration by id: rewriting the row would rewrite what those orders point
 * at. The partial unique index guarantees at most one active row survives, and the day lock makes
 * the retire-then-insert pair atomic against a concurrent checkout.
 */
export async function saveCourierDeliveryDay(
  request: CourierDeliveryDayWriteRequest,
): Promise<CourierDeliveryDayViewDto> {
  await sqlClient.begin(async (tx) => {
    await lockCourierDay(tx, request.deliveryDate)
    const courier = await tx<{ isActive: boolean }[]>`
      SELECT is_active AS "isActive" FROM couriers WHERE id = ${request.courierId} LIMIT 1
    `
    if (!courier[0]) throw new NotFoundError('پیک انتخابی پیدا نشد.')
    if (!courier[0].isActive && request.isActive) {
      throw new AppError('پیک انتخابی غیرفعال است و نمی‌توان او را برای این روز تعیین کرد.')
    }
    await tx`
      UPDATE courier_delivery_days
      SET is_active = false, updated_at = NOW()
      WHERE delivery_date = ${request.deliveryDate} AND is_active
    `
    if (!request.isActive) return
    await tx`
      INSERT INTO courier_delivery_days
        (delivery_date, courier_id, customer_delivery_fee, courier_payable_per_order,
         is_active, created_at)
      VALUES
        (${request.deliveryDate}, ${request.courierId}, ${request.customerDeliveryFee},
         ${request.courierPayablePerOrder}, true, NOW())
    `
  })
  return getCourierDeliveryDay(request.deliveryDate)
}

/** Recent arrangements, newest date first, for the Admin day page's context list. */
export async function listCourierDeliveryDays(limit = 60): Promise<CourierDeliveryDayDto[]> {
  const rows = await sqlClient<CourierDayRow[]>`
    SELECT d.id, d.delivery_date::text AS "deliveryDate", d.courier_id AS "courierId",
           c.full_name AS "courierFullName", c.mobile AS "courierMobile",
           d.customer_delivery_fee::float8 AS "customerDeliveryFee",
           d.courier_payable_per_order::float8 AS "courierPayablePerOrder",
           d.is_active AS "isActive", d.created_at AS "createdAt", d.updated_at AS "updatedAt"
    FROM courier_delivery_days d
    JOIN couriers c ON c.id = d.courier_id
    WHERE d.is_active
    ORDER BY d.delivery_date DESC, d.id DESC
    LIMIT ${Math.min(Math.max(limit, 1), 200)}
  `
  return rows.map(courierDayDto)
}

type AccountRow = {
  courierId: number
  fullName: string
  mobile: string
  isActive: boolean
  deliveredOrders: number
  earnedAmount: number
  settledAmount: number
}

const summaryOf = (row: AccountRow): CourierAccountSummaryDto => ({
  ...row,
  outstandingAmount: courierOutstanding(row),
})

/**
 * Courier work and balance, always derived — never a stored running total.
 *
 * Earnings sum the payable snapshots of orders whose current status is Delivered. Every other status
 * contributes nothing: an order that is merely confirmed, being prepared, ready, or cancelled has
 * not been delivered, so nothing is owed for it yet.
 */
async function selectAccounts(courierId: number | null): Promise<AccountRow[]> {
  return sqlClient<AccountRow[]>`
    SELECT c.id AS "courierId", c.full_name AS "fullName", c.mobile, c.is_active AS "isActive",
           COALESCE(work.delivered, 0)::int AS "deliveredOrders",
           COALESCE(work.earned, 0)::float8 AS "earnedAmount",
           COALESCE(paid.settled, 0)::float8 AS "settledAmount"
    FROM couriers c
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS delivered, SUM(o.courier_payable_amount) AS earned
      FROM orders o
      WHERE o.courier_id = c.id
        AND o.status = ${OrderStatus.Delivered}
        AND o.courier_payable_amount IS NOT NULL
    ) work ON true
    LEFT JOIN LATERAL (
      SELECT SUM(s.amount) AS settled
      FROM courier_settlements s WHERE s.courier_id = c.id
    ) paid ON true
    WHERE ${courierId}::int IS NULL OR c.id = ${courierId}
    ORDER BY c.is_active DESC, c.full_name, c.id
  `
}

export async function courierAccountSummaries(): Promise<CourierAccountSummaryDto[]> {
  return (await selectAccounts(null)).map(summaryOf)
}

export async function courierAccountSummary(courierId: number): Promise<CourierAccountSummaryDto> {
  const row = (await selectAccounts(courierId))[0]
  if (!row) throw new NotFoundError('پیک پیدا نشد.')
  return summaryOf(row)
}

type SettlementRow = Omit<CourierSettlementDto, 'settledAt' | 'createdAt'> & {
  settledAt: DbTimestamp
  createdAt: DbTimestamp
}

export async function listCourierSettlements(courierId: number): Promise<CourierSettlementDto[]> {
  const rows = await sqlClient<SettlementRow[]>`
    SELECT id, courier_id AS "courierId", amount::float8 AS amount,
           settled_at AS "settledAt", note, created_at AS "createdAt"
    FROM courier_settlements
    WHERE courier_id = ${courierId}
    ORDER BY settled_at DESC, id DESC
  `
  return rows.map((row) => ({ ...row, settledAt: iso(row.settledAt), createdAt: iso(row.createdAt) }))
}

/**
 * Records money handed to a courier and returns the recomputed balance.
 *
 * The balance is re-derived inside the transaction under a courier-scoped advisory lock, so two
 * operators settling at once cannot both pass the "does this fit in the outstanding balance" check
 * against the same stale figure. Nothing about the orders is touched: their payable snapshots are
 * the historical record of work done, and paying for that work does not change what was done.
 */
export async function recordCourierSettlement(
  request: CourierSettlementWriteRequest,
): Promise<CourierAccountSummaryDto> {
  await sqlClient.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`kafgir-courier-settle-${request.courierId}`}))`
    const rows = await tx<{ earned: number; settled: number }[]>`
      SELECT COALESCE((
        SELECT SUM(o.courier_payable_amount) FROM orders o
        WHERE o.courier_id = ${request.courierId} AND o.status = ${OrderStatus.Delivered}
      ), 0)::float8 AS earned,
      COALESCE((
        SELECT SUM(s.amount) FROM courier_settlements s WHERE s.courier_id = ${request.courierId}
      ), 0)::float8 AS settled
      FROM couriers WHERE id = ${request.courierId}
    `
    if (!rows[0]) throw new NotFoundError('پیک پیدا نشد.')
    const outstanding = courierOutstanding({
      earnedAmount: rows[0].earned,
      settledAmount: rows[0].settled,
    })
    const rejection = settlementRejection(request.amount, outstanding)
    if (rejection) throw new AppError(rejection)
    await tx`
      INSERT INTO courier_settlements (courier_id, amount, settled_at, note, created_at)
      VALUES (${request.courierId}, ${request.amount}, NOW(), ${optionalText(request.note)}, NOW())
    `
  })
  return courierAccountSummary(request.courierId)
}
