import type {
  CustomerPaymentDto,
  PagedResult,
  PaymentReconciliationDto,
  PaymentRefundWriteRequest,
  PaymentStatusWriteRequest,
  PaymentWriteRequest,
  UnpaidOrderDto,
} from '@kafgir/contracts'
import { OrderStatus, PaymentStatus } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { orderServiceDate } from '../db/service-date'
import { orderNumberSearchDigits } from '../domain/order-number'
import { pagedResult, resolvePaging } from '../db/paginate'
import { AppError, NotFoundError } from '../errors'
import { isAllowedPaymentTransition } from '../domain/payment-rules'
import { optionalText } from '../domain/order-rules'
import { logger } from '../logging/logger'

/**
 * Recording that an order was paid.
 *
 * What survived the removal of the accounting system is exactly the part the kitchen uses: which
 * order, how much, by what method, and whether it went through. A payment no longer selects a
 * financial account or a POS terminal and no longer writes a ledger entry — `payment_method` alone
 * answers "was this a POS payment?", which is all anyone ever asked it.
 */

/** The states an operator actually filters by on the payments screen. */
export type PaymentBucket = 'all' | 'successful' | 'failed' | 'pending' | 'refunded' | 'refundDue'

type DbTimestamp = Date | string
const iso = (value: DbTimestamp) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIso = (value: DbTimestamp | null) => (value ? iso(value) : null)

type PaymentRow = Omit<CustomerPaymentDto, 'paidAt' | 'createdAt' | 'refundedAt'> & {
  paidAt: DbTimestamp | null
  createdAt: DbTimestamp
  refundedAt: DbTimestamp | null
}

const dto = (row: PaymentRow): CustomerPaymentDto => ({
  ...row,
  paidAt: nullableIso(row.paidAt),
  createdAt: iso(row.createdAt),
  refundedAt: nullableIso(row.refundedAt),
})

async function audit(action: string, id: number, userId: number, details?: string) {
  await sqlClient`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES (${action}, 'payment', ${id}, ${userId}, ${details ?? null}, NOW())
  `
  logger.info({ event: action, entityType: 'payment', entityId: id, userId }, 'پرداخت ثبت شد')
}

export async function createPayment(input: PaymentWriteRequest, userId: number): Promise<number> {
  const id = await sqlClient.begin(async (tx) => {
    const orders = await tx<{ status: number; totalAmount: number }[]>`
      SELECT status, total_amount::float8 AS "totalAmount" FROM orders WHERE id = ${input.orderId} FOR UPDATE
    `
    if (!orders[0]) throw new NotFoundError('سفارش یافت نشد.')
    if (orders[0].status === OrderStatus.Cancelled) {
      throw new AppError('برای سفارش لغوشده نمی‌توان پرداخت ثبت کرد.')
    }
    // Everything not yet refused still occupies part of the order's value; a refunded part is free again.
    const allocated = await tx<{ amount: number }[]>`
      SELECT COALESCE(SUM(amount - refunded_amount), 0)::float8 AS amount FROM payments
      WHERE order_id = ${input.orderId}
        AND status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification}, ${PaymentStatus.Paid})
    `
    if (allocated[0]!.amount + input.amount > orders[0].totalAmount) {
      throw new AppError('مجموع پرداخت‌ها از مبلغ سفارش بیشتر می‌شود.')
    }
    const rows = await tx<{ id: number }[]>`
      INSERT INTO payments
        (order_id, payment_method, amount, status, tracking_number, reference_number,
         receipt_image_url, description, created_at, updated_at)
      VALUES
        (${input.orderId}, ${input.paymentMethod}, ${input.amount}, ${PaymentStatus.Pending},
         ${optionalText(input.trackingNumber)}, ${optionalText(input.referenceNumber)},
         ${optionalText(input.receiptImageUrl)}, ${optionalText(input.description)}, NOW(), NOW())
      RETURNING id
    `
    return rows[0]!.id
  })
  await audit('payment.create', id, userId, String(input.amount))
  return id
}

export async function changePaymentStatus(
  id: number,
  input: PaymentStatusWriteRequest,
  userId: number,
): Promise<void> {
  const changed = await sqlClient.begin(async (tx) => {
    const rows = await tx<{ status: number }[]>`
      SELECT status FROM payments WHERE id = ${id} FOR UPDATE
    `
    if (!rows[0]) throw new NotFoundError('پرداخت یافت نشد.')
    if (rows[0].status === input.status) return false
    if (!isAllowedPaymentTransition(rows[0].status, input.status)) {
      throw new AppError('انتقال وضعیت پرداخت مجاز نیست.')
    }
    await tx`
      UPDATE payments
      SET status = ${input.status},
          description = COALESCE(${optionalText(input.description)}, description),
          paid_at = CASE WHEN ${input.status}::int = ${PaymentStatus.Paid}::int THEN NOW() ELSE paid_at END,
          confirmed_at = CASE WHEN ${input.status}::int = ${PaymentStatus.Paid}::int THEN NOW() ELSE confirmed_at END,
          confirmed_by_user_id = CASE WHEN ${input.status}::int = ${PaymentStatus.Paid}::int
            THEN ${userId}::int ELSE confirmed_by_user_id END,
          updated_at = NOW()
      WHERE id = ${id}
    `
    return true
  })
  if (changed) await audit('payment.status', id, userId, String(input.status))
}

/**
 * Hands part or all of a paid payment back. The refunded part is recorded with its reason, time and
 * operator; once the whole amount has gone back the payment is also marked «Refunded». Refunds come
 * off sales in the month reports, so this is the only place money leaves a payment.
 */
export async function refundPayment(id: number, input: PaymentRefundWriteRequest, userId: number): Promise<void> {
  await sqlClient.begin(async (tx) => {
    const rows = await tx<{ status: number; amount: number; refundedAmount: number }[]>`
      SELECT status, amount::float8 AS amount, refunded_amount::float8 AS "refundedAmount"
      FROM payments WHERE id = ${id} FOR UPDATE
    `
    const payment = rows[0]
    if (!payment) throw new NotFoundError('پرداخت یافت نشد.')
    if (payment.status !== PaymentStatus.Paid) throw new AppError('فقط پرداخت موفق قابل استرداد است.')
    const refundable = Math.round((payment.amount - payment.refundedAmount) * 100) / 100
    if (input.amount > refundable) {
      throw new AppError('مبلغ استرداد از مبلغ قابل برگشت این پرداخت بیشتر است.')
    }
    const full = Math.abs(refundable - input.amount) < 0.005
    await tx`
      UPDATE payments
      SET refunded_amount = refunded_amount + ${input.amount},
          refund_reason = ${input.reason.trim()},
          refunded_at = NOW(),
          refunded_by_user_id = ${userId},
          status = CASE WHEN ${full} THEN ${PaymentStatus.Refunded} ELSE status END,
          updated_at = NOW()
      WHERE id = ${id}
    `
  })
  await audit('payment.refund', id, userId, `${input.amount} — ${input.reason.trim()}`)
}

const paymentColumns = sqlClient`
  p.id, p.order_id AS "orderId", o.order_number AS "orderNumber",
  o.delivery_full_name AS "customerFullName", o.delivery_phone_number AS "customerPhoneNumber",
  o.total_amount::float8 AS "orderTotalAmount", p.payment_method AS "paymentMethod",
  p.amount::float8 AS amount, p.status, p.tracking_number AS "trackingNumber",
  p.reference_number AS "referenceNumber", p.receipt_image_url AS "receiptImageUrl",
  p.description, p.paid_at AS "paidAt", p.created_at AS "createdAt",
  p.refunded_amount::float8 AS "refundedAmount", p.refund_reason AS "refundReason",
  p.refunded_at AS "refundedAt", o.status AS "orderStatus"
`

/** Paid money still held against a cancelled order: it has to go back to the customer. */
const refundDueSql = sqlClient`(p.status = ${PaymentStatus.Paid} AND o.status = ${OrderStatus.Cancelled} AND p.refunded_amount < p.amount)`

const bucketFilter = (bucket: PaymentBucket) => {
  switch (bucket) {
    case 'successful': return sqlClient`p.status = ${PaymentStatus.Paid}`
    case 'failed': return sqlClient`p.status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled})`
    case 'pending': return sqlClient`p.status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification})`
    case 'refunded': return sqlClient`p.refunded_amount > 0`
    case 'refundDue': return refundDueSql
    default: return sqlClient`TRUE`
  }
}

export async function listPayments(
  bucket: PaymentBucket = 'all',
  page?: number,
  pageSize?: number,
  search?: string | null,
): Promise<PagedResult<CustomerPaymentDto>> {
  const paging = resolvePaging(page, pageSize)
  const orderNumber = orderNumberSearchDigits(search)
  const rows = await sqlClient<Array<PaymentRow & { totalCount: number }>>`
    SELECT ${paymentColumns}, COUNT(*) OVER ()::int AS "totalCount"
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE ${bucketFilter(bucket)}
      AND (${orderNumber}::text IS NULL OR regexp_replace(o.order_number, '[^0-9]', '', 'g') LIKE '%' || ${orderNumber} || '%')
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${paging.limit} OFFSET ${paging.offset}
  `
  return pagedResult(
    rows.map(({ totalCount: _ignored, ...row }) => dto(row)),
    rows[0]?.totalCount ?? 0,
    paging,
  )
}

/** Counts and amounts per bucket, for the payments screen header. One pass over the table. */
export async function paymentBucketTotals(): Promise<Record<PaymentBucket, { count: number; amount: number }>> {
  const rows = await sqlClient<Array<Record<string, number>>>`
    SELECT
      COUNT(*)::int AS "allCount", COALESCE(SUM(p.amount), 0)::float8 AS "allAmount",
      COUNT(*) FILTER (WHERE p.status = ${PaymentStatus.Paid})::int AS "successfulCount",
      COALESCE(SUM(p.amount) FILTER (WHERE p.status = ${PaymentStatus.Paid}), 0)::float8 AS "successfulAmount",
      COUNT(*) FILTER (WHERE p.status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled}))::int AS "failedCount",
      COALESCE(SUM(p.amount) FILTER (WHERE p.status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled})), 0)::float8 AS "failedAmount",
      COUNT(*) FILTER (WHERE p.status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification}))::int AS "pendingCount",
      COALESCE(SUM(p.amount) FILTER (WHERE p.status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification})), 0)::float8 AS "pendingAmount",
      COUNT(*) FILTER (WHERE p.refunded_amount > 0)::int AS "refundedCount",
      COALESCE(SUM(p.refunded_amount), 0)::float8 AS "refundedAmount",
      COUNT(*) FILTER (WHERE ${refundDueSql})::int AS "refundDueCount",
      COALESCE(SUM(p.amount - p.refunded_amount) FILTER (WHERE ${refundDueSql}), 0)::float8 AS "refundDueAmount"
    FROM payments p
    JOIN orders o ON o.id = p.order_id
  `
  const row = rows[0] ?? {}
  const bucket = (name: PaymentBucket) => ({
    count: row[`${name}Count`] ?? 0,
    amount: row[`${name}Amount`] ?? 0,
  })
  return {
    all: bucket('all'),
    successful: bucket('successful'),
    failed: bucket('failed'),
    pending: bucket('pending'),
    refunded: bucket('refunded'),
    refundDue: bucket('refundDue'),
  }
}

/**
 * Orders whose money has not fully arrived: delivered or ready to hand over, not cancelled, with
 * confirmed payments (net of refunds) below the order total. Cash orders appear here until someone
 * records the cash — which is exactly the reconciliation the kitchen needs at the end of the day.
 */
export async function listUnpaidOrders(page?: number, pageSize?: number): Promise<PagedResult<UnpaidOrderDto>> {
  const paging = resolvePaging(page, pageSize)
  const rows = await sqlClient<Array<UnpaidOrderDto & { totalCount: number }>>`
    WITH money AS (
      SELECT o.id,
             COALESCE(SUM(p.amount - p.refunded_amount) FILTER (WHERE p.status = ${PaymentStatus.Paid}), 0) AS paid,
             COALESCE(SUM(p.amount) FILTER (WHERE p.status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification})), 0) AS pending
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.status IN (${OrderStatus.Ready}, ${OrderStatus.Delivered})
      GROUP BY o.id
    )
    SELECT o.id AS "orderId", o.order_number AS "orderNumber",
           o.delivery_full_name AS "customerFullName", o.delivery_phone_number AS "customerPhoneNumber",
           o.status, o.payment_method AS "paymentMethod", ${orderServiceDate('o')}::text AS "serviceDate",
           o.total_amount::float8 AS "totalAmount", m.paid::float8 AS "paidAmount",
           m.pending::float8 AS "pendingAmount", (o.total_amount - m.paid)::float8 AS balance,
           COUNT(*) OVER ()::int AS "totalCount"
    FROM money m
    JOIN orders o ON o.id = m.id
    WHERE m.paid + 0.005 < o.total_amount
    ORDER BY ${orderServiceDate('o')} DESC, o.id DESC
    LIMIT ${paging.limit} OFFSET ${paging.offset}
  `
  return pagedResult(rows.map(({ totalCount: _ignored, ...row }) => row), rows[0]?.totalCount ?? 0, paging)
}

/**
 * One day's money by method, for closing the till: payments confirmed that Tehran day, refunds made
 * that day, and how many orders delivered that day are still not fully paid.
 */
export async function paymentReconciliation(date: string): Promise<PaymentReconciliationDto> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new AppError('تاریخ معتبر نیست.')
  const methods = await sqlClient<Array<{ paymentMethod: number; count: number; received: number; refunded: number }>>`
    WITH day AS (
      SELECT (${date}::date AT TIME ZONE 'Asia/Tehran') AS starts,
             ((${date}::date + 1) AT TIME ZONE 'Asia/Tehran') AS ends
    )
    SELECT p.payment_method AS "paymentMethod",
           COUNT(*) FILTER (WHERE p.paid_at >= day.starts AND p.paid_at < day.ends)::int AS count,
           COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at >= day.starts AND p.paid_at < day.ends), 0)::float8 AS received,
           COALESCE(SUM(p.refunded_amount) FILTER (WHERE p.refunded_at >= day.starts AND p.refunded_at < day.ends), 0)::float8 AS refunded
    FROM payments p CROSS JOIN day
    WHERE (p.paid_at >= day.starts AND p.paid_at < day.ends)
       OR (p.refunded_at >= day.starts AND p.refunded_at < day.ends)
    GROUP BY p.payment_method
    ORDER BY p.payment_method
  `
  const unpaid = await sqlClient<Array<{ count: number; amount: number }>>`
    WITH paid AS (
      SELECT o.id, o.total_amount,
             COALESCE(SUM(p.amount - p.refunded_amount) FILTER (WHERE p.status = ${PaymentStatus.Paid}), 0) AS paid
      FROM orders o LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.status = ${OrderStatus.Delivered} AND ${orderServiceDate('o')} = ${date}::date
      GROUP BY o.id, o.total_amount
    )
    SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount - paid), 0)::float8 AS amount
    FROM paid WHERE paid + 0.005 < total_amount
  `
  const rows = methods.map((row) => ({ ...row, net: row.received - row.refunded }))
  const received = rows.reduce((sum, row) => sum + row.received, 0)
  const refunded = rows.reduce((sum, row) => sum + row.refunded, 0)
  return {
    date,
    methods: rows,
    totals: { received, refunded, net: received - refunded },
    unpaidDeliveredCount: unpaid[0]?.count ?? 0,
    unpaidDeliveredAmount: unpaid[0]?.amount ?? 0,
  }
}
