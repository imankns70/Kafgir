import {
  OrderStatus,
  type CustomerDetailDto,
  type CustomerDirectoryPageDto,
  type CustomerDirectoryQuery,
  type CustomerDirectoryRowDto,
  type CustomerHistoryAddressDto,
  type CustomerHistoryOrderDto,
  type CustomerHistoryReviewDto,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { NotFoundError } from '../errors'
import { averageOrderValue } from '../domain/customer-report-rules'
import {
  customerSearchTerms,
  customerSortClause,
  normalizePersianName,
} from '../domain/customer-search-rules'

/**
 * Customer lookup and history.
 *
 * The money rules match the customer report exactly — revenue is delivered orders, order counts skip
 * cancellations — so the same customer never shows two different lifetime values across screens.
 */

/** Statuses that mean the order is still in flight. Mirrors the customer-facing active tracker. */
const activeStatuses = [
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
] as const

/** History is capped so one long-standing customer cannot stall the desktop app over a slow link. */
const orderHistoryLimit = 200

type DbDate = Date | string
const iso = (value: DbDate) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIso = (value: DbDate | null) => value == null ? null : iso(value)

/**
 * The SQL twin of `normalizePersianName`. Both sides of a name comparison run through it, so a term
 * typed with an Arabic `ي` or a zero-width non-joiner still matches the stored spelling.
 *
 * Kept as one string constant used for every name expression: if this and the TypeScript normaliser
 * ever drift, name search fails silently rather than loudly, so there is a test asserting they agree.
 */
const foldName = (expression: string) =>
  `regexp_replace(translate(lower(${expression}), 'يىكة', 'ییکه'), '[[:space:]‌‍]', '', 'g')`

/** Everything after the first whitespace run; empty for a single-token name. */
const familyPart = `regexp_replace(btrim(p.preferred_name), '^[^[:space:]]+[[:space:]]*', '')`
const givenPart = `split_part(btrim(p.preferred_name), ' ', 1)`

type DirectoryRow = Omit<CustomerDirectoryRowDto, 'joinedAt' | 'lastOrderAt'> & {
  joinedAt: DbDate
  lastOrderAt: DbDate | null
  totalCount: number
}

export async function searchCustomers(query: CustomerDirectoryQuery): Promise<CustomerDirectoryPageDto> {
  const { name, phone } = customerSearchTerms(query.search)
  // Folded here so the bound parameter and the column expression are shaped identically.
  const firstName = query.firstName?.trim() ? normalizePersianName(query.firstName) : null
  const lastName = query.lastName?.trim() ? normalizePersianName(query.lastName) : null
  const channel = query.channel ?? null
  const joinedFrom = query.joinedFrom ?? null
  const joinedTo = query.joinedTo ?? null
  const city = query.city?.trim() || null
  const minOrders = query.minOrders ?? null
  const minSpent = query.minSpent ?? null
  const offset = (query.page - 1) * query.pageSize

  // The sort fragment is looked up from a whitelist, never interpolated from caller text.
  const orderBy = customerSortClause(query.sort)

  const rows = await sqlClient<DirectoryRow[]>`
    WITH customer_orders AS (
      SELECT o.customer_profile_id AS profile_id,
             COUNT(*) FILTER (WHERE o.status <> ${OrderStatus.Cancelled})::int AS order_count,
             COUNT(*) FILTER (WHERE o.status = ${OrderStatus.Cancelled})::int AS cancelled_count,
             COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = ${OrderStatus.Delivered}), 0)::float8
               AS total_spent,
             MAX(o.created_at) FILTER (WHERE o.status <> ${OrderStatus.Cancelled}) AS last_order_at,
             BOOL_OR(o.status = ANY(${sqlClient.array([...activeStatuses])}::int[])) AS has_active_order,
             (ARRAY_AGG(o.delivery_city ORDER BY o.created_at DESC))[1] AS last_city
      FROM orders o GROUP BY o.customer_profile_id
    ),
    base AS (
      SELECT p.id AS "customerProfileId", p.preferred_name AS "preferredName",
             COALESCE(NULLIF(p.default_phone_number, ''), u.phone_number, '') AS "phoneNumber",
             CASE WHEN t.user_id IS NULL THEN 'phone' ELSE 'telegram' END AS channel,
             p.created_at AS "joinedAt",
             COALESCE(co.order_count, 0) AS "orderCount",
             COALESCE(co.cancelled_count, 0) AS "cancelledCount",
             COALESCE(co.total_spent, 0)::float8 AS "totalSpent",
             co.last_order_at AS "lastOrderAt",
             COALESCE(co.has_active_order, false) AS "hasActiveOrder",
             COALESCE(co.last_city, (
               SELECT a.city FROM customer_addresses a
               WHERE a.customer_profile_id = p.id AND a.is_active = true
               ORDER BY a.is_default DESC, a.last_used_at DESC NULLS LAST, a.id LIMIT 1
             )) AS city
      FROM customer_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN telegram_accounts t ON t.user_id = p.user_id
      LEFT JOIN customer_orders co ON co.profile_id = p.id
      WHERE (${name}::text IS NULL OR p.preferred_name ILIKE '%' || ${name} || '%')
        AND (${firstName}::text IS NULL OR
             ${sqlClient.unsafe(foldName(givenPart))} LIKE '%' || ${firstName} || '%' OR
             ${sqlClient.unsafe(foldName('COALESCE(u.telegram_first_name, \'\')'))}
               LIKE '%' || ${firstName} || '%')
        AND (${lastName}::text IS NULL OR
             ${sqlClient.unsafe(foldName(familyPart))} LIKE '%' || ${lastName} || '%' OR
             ${sqlClient.unsafe(foldName('COALESCE(u.telegram_last_name, \'\')'))}
               LIKE '%' || ${lastName} || '%')
        AND (${phone}::text IS NULL OR
             regexp_replace(COALESCE(NULLIF(p.default_phone_number, ''), u.phone_number, ''), '\\D', '', 'g')
               LIKE '%' || ${phone} || '%')
        AND (${channel}::text IS NULL OR
             (CASE WHEN t.user_id IS NULL THEN 'phone' ELSE 'telegram' END) = ${channel})
        AND (${joinedFrom}::text IS NULL OR
             p.created_at >= (${joinedFrom}::date AT TIME ZONE 'Asia/Tehran'))
        AND (${joinedTo}::text IS NULL OR
             p.created_at < ((${joinedTo}::date + 1) AT TIME ZONE 'Asia/Tehran'))
        AND (${city}::text IS NULL OR EXISTS (
          SELECT 1 FROM customer_addresses a
          WHERE a.customer_profile_id = p.id AND a.city ILIKE '%' || ${city} || '%'
        ) OR EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.customer_profile_id = p.id AND o2.delivery_city ILIKE '%' || ${city} || '%'
        ))
    ),
    filtered AS (
      SELECT * FROM base
      WHERE (${minOrders}::int IS NULL OR "orderCount" >= ${minOrders})
        AND (${minSpent}::float8 IS NULL OR "totalSpent" >= ${minSpent})
        AND CASE ${query.activity}::text
              WHEN 'never-ordered' THEN "orderCount" = 0
              WHEN 'has-ordered' THEN "orderCount" > 0
              WHEN 'active-order' THEN "hasActiveOrder"
              -- Ordered at some point, but nothing inside the silence window.
              WHEN 'lapsed' THEN "orderCount" > 0 AND "lastOrderAt" <
                (NOW() - (${query.lapsedDays}::int * INTERVAL '1 day'))
              ELSE true
            END
    )
    SELECT *, COUNT(*) OVER ()::int AS "totalCount"
    FROM filtered
    ORDER BY ${sqlClient.unsafe(orderBy)}
    LIMIT ${query.pageSize} OFFSET ${offset}
  `

  const totalItems = rows[0]?.totalCount ?? 0
  return {
    items: rows.map((row) => ({
      customerProfileId: row.customerProfileId,
      preferredName: row.preferredName,
      phoneNumber: row.phoneNumber,
      channel: row.channel,
      joinedAt: iso(row.joinedAt),
      orderCount: row.orderCount,
      cancelledCount: row.cancelledCount,
      totalSpent: row.totalSpent,
      lastOrderAt: nullableIso(row.lastOrderAt),
      hasActiveOrder: row.hasActiveOrder,
      city: row.city,
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / query.pageSize),
  }
}

export async function getCustomerDetail(customerProfileId: number): Promise<CustomerDetailDto> {
  if (!Number.isSafeInteger(customerProfileId) || customerProfileId <= 0) {
    throw new NotFoundError('مشتری پیدا نشد.')
  }

  type ProfileRow = {
    customerProfileId: number
    preferredName: string
    phoneNumber: string
    channel: 'telegram' | 'phone'
    telegramUsername: string | null
    joinedAt: DbDate
    orderCount: number
    deliveredCount: number
    cancelledCount: number
    totalSpent: number
    firstOrderAt: DbDate | null
    lastOrderAt: DbDate | null
    reviewCount: number
    averageRating: number | null
    supportConversationCount: number
  }

  const [profiles, orderRows, reviewRows, addressRows] = await Promise.all([
    sqlClient<ProfileRow[]>`
      SELECT p.id AS "customerProfileId", p.preferred_name AS "preferredName",
             COALESCE(NULLIF(p.default_phone_number, ''), u.phone_number, '') AS "phoneNumber",
             CASE WHEN t.user_id IS NULL THEN 'phone' ELSE 'telegram' END AS channel,
             t.username AS "telegramUsername",
             p.created_at AS "joinedAt",
             (SELECT COUNT(*)::int FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status <> ${OrderStatus.Cancelled}) AS "orderCount",
             (SELECT COUNT(*)::int FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status = ${OrderStatus.Delivered}) AS "deliveredCount",
             (SELECT COUNT(*)::int FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status = ${OrderStatus.Cancelled}) AS "cancelledCount",
             (SELECT COALESCE(SUM(o.total_amount), 0)::float8 FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status = ${OrderStatus.Delivered}) AS "totalSpent",
             (SELECT MIN(o.created_at) FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status <> ${OrderStatus.Cancelled}) AS "firstOrderAt",
             (SELECT MAX(o.created_at) FROM orders o
               WHERE o.customer_profile_id = p.id AND o.status <> ${OrderStatus.Cancelled}) AS "lastOrderAt",
             (SELECT COUNT(*)::int FROM order_reviews r
               WHERE r.customer_profile_id = p.id) AS "reviewCount",
             (SELECT ROUND(AVG(r.rating), 1)::float8 FROM order_reviews r
               WHERE r.customer_profile_id = p.id) AS "averageRating",
             (SELECT COUNT(*)::int FROM support_conversations c
               WHERE c.customer_profile_id = p.id) AS "supportConversationCount"
      FROM customer_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN telegram_accounts t ON t.user_id = p.user_id
      WHERE p.id = ${customerProfileId}
      LIMIT 1
    `,
    sqlClient<Array<Omit<CustomerHistoryOrderDto, 'createdAt'> & { createdAt: DbDate }>>`
      SELECT o.id, o.order_number AS "orderNumber", o.status, o.created_at AS "createdAt",
             o.total_amount::float8 AS "totalAmount",
             o.delivery_city AS "deliveryCity", o.delivery_address_line AS "addressLine",
             o.delivery_date::text AS "deliveryDate",
             CASE WHEN o.delivery_time_slot_title IS NULL THEN NULL
               ELSE o.delivery_time_slot_title || ' (' ||
                 to_char(o.delivery_start_time, 'HH24:MI') || ' تا ' ||
                 to_char(o.delivery_end_time, 'HH24:MI') || ')' END AS "deliveryWindow",
             COALESCE((
               SELECT string_agg(oi.food_name || ' × ' || oi.quantity, '، ' ORDER BY oi.id)
               FROM order_items oi WHERE oi.order_id = o.id
             ), '') AS "itemSummary"
      FROM orders o
      WHERE o.customer_profile_id = ${customerProfileId}
      ORDER BY o.created_at DESC
      LIMIT ${orderHistoryLimit}
    `,
    sqlClient<Array<Omit<CustomerHistoryReviewDto, 'createdAt'> & { createdAt: DbDate }>>`
      SELECT r.order_id AS "orderId", o.order_number AS "orderNumber", r.rating, r.comment,
             r.created_at AS "createdAt"
      FROM order_reviews r
      JOIN orders o ON o.id = r.order_id
      WHERE r.customer_profile_id = ${customerProfileId}
      ORDER BY r.created_at DESC
    `,
    sqlClient<Array<Omit<CustomerHistoryAddressDto, 'lastUsedAt'> & { lastUsedAt: DbDate | null }>>`
      SELECT a.id, a.title, a.city, a.address_line AS "addressLine",
             a.is_default AS "isDefault", a.is_active AS "isActive", a.last_used_at AS "lastUsedAt"
      FROM customer_addresses a
      WHERE a.customer_profile_id = ${customerProfileId}
      ORDER BY a.is_default DESC, a.last_used_at DESC NULLS LAST, a.id
    `,
  ])

  const profile = profiles[0]
  if (!profile) throw new NotFoundError('مشتری پیدا نشد.')

  return {
    customerProfileId: profile.customerProfileId,
    preferredName: profile.preferredName,
    phoneNumber: profile.phoneNumber,
    channel: profile.channel,
    telegramUsername: profile.telegramUsername,
    joinedAt: iso(profile.joinedAt),
    orderLimit: orderHistoryLimit,
    totals: {
      orderCount: profile.orderCount,
      deliveredCount: profile.deliveredCount,
      cancelledCount: profile.cancelledCount,
      totalSpent: profile.totalSpent,
      averageOrderValue: averageOrderValue(profile.totalSpent, profile.deliveredCount),
      firstOrderAt: nullableIso(profile.firstOrderAt),
      lastOrderAt: nullableIso(profile.lastOrderAt),
      reviewCount: profile.reviewCount,
      averageRating: profile.averageRating,
      supportConversationCount: profile.supportConversationCount,
    },
    addresses: addressRows.map((row) => ({ ...row, lastUsedAt: nullableIso(row.lastUsedAt) })),
    orders: orderRows.map((row) => ({ ...row, createdAt: iso(row.createdAt) })),
    reviews: reviewRows.map((row) => ({ ...row, createdAt: iso(row.createdAt) })),
  }
}
