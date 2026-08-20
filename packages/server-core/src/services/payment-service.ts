import type {
  CustomerPaymentDto,
  PagedResult,
  PaymentStatusWriteRequest,
  PaymentWriteRequest,
} from '@kafgir/contracts'
import { OrderStatus, PaymentStatus } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
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
export type PaymentBucket = 'all' | 'successful' | 'failed' | 'pending' | 'refunded'

type DbTimestamp = Date | string
const iso = (value: DbTimestamp) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIso = (value: DbTimestamp | null) => (value ? iso(value) : null)

type PaymentRow = Omit<CustomerPaymentDto, 'paidAt' | 'createdAt'> & {
  paidAt: DbTimestamp | null
  createdAt: DbTimestamp
}

const dto = (row: PaymentRow): CustomerPaymentDto => ({
  ...row,
  paidAt: nullableIso(row.paidAt),
  createdAt: iso(row.createdAt),
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
    // Everything not yet refused still occupies part of the order's value.
    const allocated = await tx<{ amount: number }[]>`
      SELECT COALESCE(SUM(amount), 0)::float8 AS amount FROM payments
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
 * Marks a paid payment as refunded. There is no counter-entry to write any more: the payment row
 * itself is the record, and its status is the whole story.
 */
export async function refundPayment(id: number, userId: number): Promise<void> {
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE payments SET status = ${PaymentStatus.Refunded}, updated_at = NOW()
    WHERE id = ${id} AND status = ${PaymentStatus.Paid}
    RETURNING id
  `
  if (!rows[0]) throw new AppError('فقط پرداخت موفق قابل استرداد است.')
  await audit('payment.refund', id, userId)
}

const paymentColumns = sqlClient`
  p.id, p.order_id AS "orderId", o.order_number AS "orderNumber",
  o.delivery_full_name AS "customerFullName", o.delivery_phone_number AS "customerPhoneNumber",
  o.total_amount::float8 AS "orderTotalAmount", p.payment_method AS "paymentMethod",
  p.amount::float8 AS amount, p.status, p.tracking_number AS "trackingNumber",
  p.reference_number AS "referenceNumber", p.receipt_image_url AS "receiptImageUrl",
  p.description, p.paid_at AS "paidAt", p.created_at AS "createdAt"
`

const bucketFilter = (bucket: PaymentBucket) => {
  switch (bucket) {
    case 'successful': return sqlClient`p.status = ${PaymentStatus.Paid}`
    case 'failed': return sqlClient`p.status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled})`
    case 'pending': return sqlClient`p.status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification})`
    case 'refunded': return sqlClient`p.status = ${PaymentStatus.Refunded}`
    default: return sqlClient`TRUE`
  }
}

export async function listPayments(
  bucket: PaymentBucket = 'all',
  page?: number,
  pageSize?: number,
): Promise<PagedResult<CustomerPaymentDto>> {
  const paging = resolvePaging(page, pageSize)
  const rows = await sqlClient<Array<PaymentRow & { totalCount: number }>>`
    SELECT ${paymentColumns}, COUNT(*) OVER ()::int AS "totalCount"
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE ${bucketFilter(bucket)}
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
      COUNT(*)::int AS "allCount", COALESCE(SUM(amount), 0)::float8 AS "allAmount",
      COUNT(*) FILTER (WHERE status = ${PaymentStatus.Paid})::int AS "successfulCount",
      COALESCE(SUM(amount) FILTER (WHERE status = ${PaymentStatus.Paid}), 0)::float8 AS "successfulAmount",
      COUNT(*) FILTER (WHERE status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled}))::int AS "failedCount",
      COALESCE(SUM(amount) FILTER (WHERE status IN (${PaymentStatus.Failed}, ${PaymentStatus.Rejected}, ${PaymentStatus.Cancelled})), 0)::float8 AS "failedAmount",
      COUNT(*) FILTER (WHERE status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification}))::int AS "pendingCount",
      COALESCE(SUM(amount) FILTER (WHERE status IN (${PaymentStatus.Pending}, ${PaymentStatus.AwaitingVerification})), 0)::float8 AS "pendingAmount",
      COUNT(*) FILTER (WHERE status = ${PaymentStatus.Refunded})::int AS "refundedCount",
      COALESCE(SUM(amount) FILTER (WHERE status = ${PaymentStatus.Refunded}), 0)::float8 AS "refundedAmount"
    FROM payments
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
  }
}
