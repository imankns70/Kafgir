import {
  PaymentMethod,
  OrderStatus,
  type CustomerOrderDetailDto,
  type CustomerOrdersPageDto,
  type OrderReviewDto,
  type OrderReviewWriteRequest,
  type PendingOrderReviewDto,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { logger } from '../logging/logger'

type DbDate = Date | string

const isoDate = (value: DbDate) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIsoDate = (value: DbDate | null) => value == null ? null : isoDate(value)

function assertOrderId(orderId: number) {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new NotFoundError('سفارش پیدا نشد.')
}

async function profileIdForUser(userId: number) {
  const profiles = await sqlClient<{ id: number }[]>`
    SELECT id FROM customer_profiles WHERE user_id = ${userId} LIMIT 1
  `
  if (!profiles[0]) throw new NotFoundError('پروفایل مشتری پیدا نشد.')
  return profiles[0].id
}

export async function listCustomerOrderCards(
  userId: number,
  page: number,
  pageSize = 10,
): Promise<CustomerOrdersPageDto> {
  const profileId = await profileIdForUser(userId)
  const safePage = Math.max(1, page)
  const safePageSize = Math.min(25, Math.max(1, pageSize))
  const counts = await sqlClient<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM orders WHERE customer_profile_id = ${profileId}
  `
  const totalItems = counts[0]?.count ?? 0
  type SummaryRecord = Omit<CustomerOrdersPageDto['items'][number], 'createdAt' | 'statusHistories' | 'review'> & {
    createdAt: DbDate
    statusHistories: Array<{
      fromStatus: OrderStatus
      toStatus: OrderStatus
      note: string | null
      changedAt: DbDate
    }>
    review: (Omit<OrderReviewDto, 'createdAt' | 'updatedAt'> & {
      createdAt: DbDate
      updatedAt: DbDate | null
    }) | null
  }
  const rows = await sqlClient<SummaryRecord[]>`
    SELECT o.id, o.order_number AS "orderNumber", o.delivery_full_name AS "customerFullName",
           o.delivery_phone_number AS "customerPhoneNumber", o.status,
           o.total_amount::float8 AS "totalAmount", o.payment_method AS "paymentMethod",
           o.delivery_method AS "deliveryMethod", o.delivery_city AS "deliveryCity",
           o.delivery_address_line AS "addressLine", o.created_at AS "createdAt",
           COALESCE(SUM(oi.quantity), 0)::int AS "totalQuantity",
           COALESCE(string_agg(oi.food_name || ' × ' || oi.quantity, '، ' ORDER BY oi.id), '') AS "foodSummary",
           o.delivery_date::text AS "deliveryDate",
           o.delivery_time_slot_title AS "deliveryTimeSlotTitle",
           to_char(o.delivery_start_time, 'HH24:MI') AS "deliveryStartTime",
           to_char(o.delivery_end_time, 'HH24:MI') AS "deliveryEndTime",
           latest_payment.status AS "paymentStatus",
           COALESCE(history.items, '[]'::jsonb) AS "statusHistories",
           CASE WHEN review.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', review.id, 'rating', review.rating, 'comment', review.comment,
             'createdAt', review.created_at, 'updatedAt', review.updated_at
           ) END AS review
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN LATERAL (
      SELECT p.status FROM payments p WHERE p.order_id = o.id
      ORDER BY p.created_at DESC, p.id DESC LIMIT 1
    ) latest_payment ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'fromStatus', h.from_status, 'toStatus', h.to_status, 'note', h.note,
        'changedAt', h.changed_at
      ) ORDER BY h.changed_at, h.id) AS items
      FROM order_status_histories h WHERE h.order_id = o.id
    ) history ON true
    LEFT JOIN order_reviews review ON review.order_id = o.id
    WHERE o.customer_profile_id = ${profileId}
    GROUP BY o.id, latest_payment.status, history.items, review.id
    ORDER BY CASE WHEN o.status IN (
      ${OrderStatus.PendingConfirmation}, ${OrderStatus.Confirmed},
      ${OrderStatus.Preparing}, ${OrderStatus.Ready}
    ) THEN 0 ELSE 1 END, o.created_at DESC
    LIMIT ${safePageSize} OFFSET ${(safePage - 1) * safePageSize}
  `
  return {
    items: rows.map((row) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      statusHistories: row.statusHistories.map((history) => ({
        ...history,
        changedAt: isoDate(history.changedAt),
      })),
      review: row.review ? {
        ...row.review,
        createdAt: isoDate(row.review.createdAt),
        updatedAt: nullableIsoDate(row.review.updatedAt),
      } : null,
    })),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / safePageSize),
  }
}

export async function getCustomerOrderDetail(userId: number, orderId: number): Promise<CustomerOrderDetailDto> {
  assertOrderId(orderId)
  const profileId = await profileIdForUser(userId)
  type OrderRecord = Omit<CustomerOrderDetailDto,
    'items' | 'statusHistories' | 'payments' | 'review' |
    'createdAt' | 'confirmedAt' | 'deliveredAt' | 'cancelledAt'> & {
      createdAt: DbDate
      confirmedAt: DbDate | null
      deliveredAt: DbDate | null
      cancelledAt: DbDate | null
    }
  const orders = await sqlClient<OrderRecord[]>`
    SELECT o.id, o.order_number AS "orderNumber", o.delivery_full_name AS "customerFullName",
           o.delivery_phone_number AS "customerPhoneNumber", o.delivery_city AS "deliveryCity",
           o.delivery_address_line AS "addressLine", o.status,
           o.payment_method AS "paymentMethod", o.delivery_method AS "deliveryMethod",
           o.subtotal_amount::float8 AS "subtotalAmount", o.delivery_fee::float8 AS "deliveryFee",
           o.total_amount::float8 AS "totalAmount", o.customer_note AS "customerNote",
           o.created_at AS "createdAt", o.confirmed_at AS "confirmedAt",
           o.delivered_at AS "deliveredAt", o.cancelled_at AS "cancelledAt",
           o.delivery_date::text AS "deliveryDate",
           o.delivery_time_slot_title AS "deliveryTimeSlotTitle",
           to_char(o.delivery_start_time, 'HH24:MI') AS "deliveryStartTime",
           to_char(o.delivery_end_time, 'HH24:MI') AS "deliveryEndTime"
    FROM orders o WHERE o.id = ${orderId} AND o.customer_profile_id = ${profileId} LIMIT 1
  `
  const order = orders[0]
  if (!order) throw new NotFoundError('سفارش پیدا نشد.')
  const [items, histories, payments, reviews] = await Promise.all([
    sqlClient<CustomerOrderDetailDto['items']>`
      SELECT oi.id, oi.daily_menu_item_id AS "dailyMenuItemId", oi.food_name AS "foodName",
             f.allows_persian_rice AS "allowsPersianRice", f.is_persian_rice AS "isPersianRice",
             oi.original_unit_price::float8 AS "originalUnitPrice", oi.unit_price::float8 AS "unitPrice",
             oi.quantity, oi.total_price::float8 AS "totalPrice"
      FROM order_items oi
      JOIN daily_menu_items d ON d.id = oi.daily_menu_item_id
      JOIN foods f ON f.id = d.food_id
      WHERE oi.order_id = ${orderId} ORDER BY oi.id`,
    sqlClient<Array<Omit<CustomerOrderDetailDto['statusHistories'][number], 'changedAt'> & { changedAt: DbDate }>>`
      SELECT from_status AS "fromStatus", to_status AS "toStatus", note, changed_at AS "changedAt"
      FROM order_status_histories WHERE order_id = ${orderId} ORDER BY changed_at, id`,
    sqlClient<Array<Omit<CustomerOrderDetailDto['payments'][number], 'createdAt' | 'paidAt'> & {
      createdAt: DbDate
      paidAt: DbDate | null
    }>>`
      SELECT p.payment_method AS "paymentMethod", p.status, p.amount::float8 AS amount,
             CASE
               WHEN p.payment_method = ${PaymentMethod.Online} THEN COALESCE(a.bank_name, a.name)
               WHEN p.payment_method = ${PaymentMethod.Pos} THEN pt.title
               ELSE NULL
             END AS "providerName",
             p.tracking_number AS "trackingNumber", p.reference_number AS "referenceNumber",
             p.paid_at AS "paidAt", p.created_at AS "createdAt"
      FROM payments p
      JOIN financial_accounts a ON a.id = p.financial_account_id
      LEFT JOIN pos_terminals pt ON pt.id = p.pos_terminal_id
      WHERE p.order_id = ${orderId} ORDER BY p.created_at DESC, p.id DESC`,
    sqlClient<Array<Omit<OrderReviewDto, 'createdAt' | 'updatedAt'> & {
      createdAt: DbDate
      updatedAt: DbDate | null
    }>>`
      SELECT id, rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM order_reviews WHERE order_id = ${orderId} LIMIT 1`,
  ])
  const review = reviews[0]
  return {
    ...order,
    createdAt: isoDate(order.createdAt),
    confirmedAt: nullableIsoDate(order.confirmedAt),
    deliveredAt: nullableIsoDate(order.deliveredAt),
    cancelledAt: nullableIsoDate(order.cancelledAt),
    items,
    statusHistories: histories.map((history) => ({ ...history, changedAt: isoDate(history.changedAt) })),
    payments: payments.map((payment) => ({
      ...payment,
      createdAt: isoDate(payment.createdAt),
      paidAt: nullableIsoDate(payment.paidAt),
    })),
    review: review ? {
      ...review,
      createdAt: isoDate(review.createdAt),
      updatedAt: nullableIsoDate(review.updatedAt),
    } : null,
  }
}

/**
 * The order the customer should be prompted to rate, or null when there is nothing to ask about.
 *
 * Eligibility is decided here, not by the caller: the order must belong to this authenticated
 * customer, must have actually reached Delivered, and must not already carry a review. Oldest
 * first, so a backlog drains in the order the customer experienced it rather than newest-first.
 *
 * `LIMIT 1` keeps this cheap enough to run on every app open — the prompt only ever needs one
 * order, so there is no reason to read the customer's history to find it.
 */
export async function getPendingOrderReview(userId: number): Promise<PendingOrderReviewDto | null> {
  const profileId = await profileIdForUser(userId)
  const rows = await sqlClient<Array<{ orderId: number; orderNumber: string; deliveredAt: DbDate | null }>>`
    SELECT o.id AS "orderId", o.order_number AS "orderNumber", o.delivered_at AS "deliveredAt"
    FROM orders o
    WHERE o.customer_profile_id = ${profileId}
      AND o.status = ${OrderStatus.Delivered}
      AND NOT EXISTS (SELECT 1 FROM order_reviews r WHERE r.order_id = o.id)
    ORDER BY COALESCE(o.delivered_at, o.created_at) ASC, o.id ASC
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return { orderId: row.orderId, orderNumber: row.orderNumber, deliveredAt: nullableIsoDate(row.deliveredAt) }
}

export async function saveCustomerOrderReview(
  userId: number,
  orderId: number,
  input: OrderReviewWriteRequest,
): Promise<OrderReviewDto> {
  assertOrderId(orderId)
  const profileId = await profileIdForUser(userId)
  const result = await sqlClient.begin(async (tx) => {
    const orders = await tx<{ status: OrderStatus }[]>`
      SELECT status FROM orders
      WHERE id = ${orderId} AND customer_profile_id = ${profileId}
      FOR UPDATE
    `
    const order = orders[0]
    if (!order) throw new NotFoundError('سفارش پیدا نشد.')
    if (order.status !== OrderStatus.Delivered) {
      throw new AppError('ثبت امتیاز فقط پس از تحویل موفق سفارش امکان‌پذیر است.')
    }
    const rows = await tx<Array<Omit<OrderReviewDto, 'createdAt' | 'updatedAt'> & {
      createdAt: DbDate
      updatedAt: DbDate | null
    }>>`
      INSERT INTO order_reviews
        (order_id, customer_profile_id, rating, comment, created_at)
      VALUES (${orderId}, ${profileId}, ${input.rating}, ${input.comment ?? null}, NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        handling_status = 1,
        admin_seen_at = NULL,
        resolved_at = NULL,
        resolved_by_user_id = NULL,
        updated_at = NOW()
      WHERE order_reviews.customer_profile_id = ${profileId}
      RETURNING id, rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"
    `
    const review = rows[0]
    if (!review) throw new NotFoundError('امتیاز سفارش پیدا نشد.')
    return {
      ...review,
      createdAt: isoDate(review.createdAt),
      updatedAt: nullableIsoDate(review.updatedAt),
    }
  })
  logger.info({ event: 'customer.order.review.saved', userId, orderId, rating: input.rating }, 'امتیاز سفارش ذخیره شد')
  return result
}
