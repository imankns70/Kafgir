import {
  OrderReviewHandlingStatus,
  SupportConversationStatus,
  SupportSenderType,
  type AdminOrderReviewDto,
  type AdminSupportConversationDto,
  type AdminSupportConversationSummaryDto,
  type CustomerSupportConversationCreateRequest,
  type CustomerSupportConversationDto,
  type SupportConversationSummaryDto,
  type SupportMessageWriteRequest,
} from '@kafgir/contracts'
import type { PagedResult } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { pagedResult, resolvePaging } from '../db/paginate'
import { AppError, NotFoundError } from '../errors'
import { logger } from '../logging/logger'

type DbDate = Date | string
const isoDate = (value: DbDate) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIsoDate = (value: DbDate | null) => value == null ? null : isoDate(value)

async function profileIdForUser(userId: number) {
  const rows = await sqlClient<{ id: number }[]>`
    SELECT id FROM customer_profiles WHERE user_id = ${userId} LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError('پروفایل مشتری پیدا نشد.')
  return rows[0].id
}

function assertId(id: number, entity = 'گفتگو') {
  if (!Number.isSafeInteger(id) || id <= 0) throw new NotFoundError(`${entity} پیدا نشد.`)
}

type SummaryRow = Omit<SupportConversationSummaryDto, 'lastMessageAt' | 'createdAt'> & {
  lastMessageAt: DbDate
  createdAt: DbDate
}

type AdminSummaryRow = Omit<AdminSupportConversationSummaryDto, 'lastMessageAt' | 'createdAt'> & {
  lastMessageAt: DbDate
  createdAt: DbDate
}

const mapSummary = (row: SummaryRow): SupportConversationSummaryDto => ({
  ...row,
  lastMessageAt: isoDate(row.lastMessageAt),
  createdAt: isoDate(row.createdAt),
})

const mapAdminSummary = (row: AdminSummaryRow): AdminSupportConversationSummaryDto => ({
  ...row,
  lastMessageAt: isoDate(row.lastMessageAt),
  createdAt: isoDate(row.createdAt),
})

type MessageRow = {
  id: number
  senderType: SupportSenderType
  senderName: string
  message: string
  createdAt: DbDate
  readAt: DbDate | null
}

const mapMessage = (row: MessageRow) => ({
  ...row,
  createdAt: isoDate(row.createdAt),
  readAt: nullableIsoDate(row.readAt),
})

const customerSummaryQuery = async (profileId: number, conversationId?: number) => sqlClient<SummaryRow[]>`
  SELECT c.id, c.subject, ss.title AS "subjectTitle", c.status,
         c.order_id AS "orderId", o.order_number AS "orderNumber",
         c.review_id AS "reviewId", last_message.message AS "lastMessage",
         c.last_message_at AS "lastMessageAt", c.created_at AS "createdAt",
         COALESCE(unread.count, 0)::int AS "unreadCount"
  FROM support_conversations c
  JOIN support_subjects ss ON ss.id = c.subject
  LEFT JOIN orders o ON o.id = c.order_id
  JOIN LATERAL (
    SELECT message FROM support_messages WHERE conversation_id = c.id
    ORDER BY created_at DESC, id DESC LIMIT 1
  ) last_message ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS count FROM support_messages
    WHERE conversation_id = c.id AND sender_type = ${SupportSenderType.Admin} AND read_at IS NULL
  ) unread ON true
  WHERE c.customer_profile_id = ${profileId}
    AND (${conversationId ?? null}::int IS NULL OR c.id = ${conversationId ?? null})
  ORDER BY c.last_message_at DESC, c.id DESC
`

export async function listCustomerSupportConversations(userId: number) {
  const profileId = await profileIdForUser(userId)
  return (await customerSummaryQuery(profileId)).map(mapSummary)
}

export async function getCustomerSupportConversation(
  userId: number,
  conversationId: number,
): Promise<CustomerSupportConversationDto> {
  assertId(conversationId)
  const profileId = await profileIdForUser(userId)
  await sqlClient`
    UPDATE support_messages SET read_at = NOW()
    WHERE conversation_id = ${conversationId} AND sender_type = ${SupportSenderType.Admin}
      AND read_at IS NULL
      AND EXISTS (SELECT 1 FROM support_conversations c
        WHERE c.id = ${conversationId} AND c.customer_profile_id = ${profileId})
  `
  const summaries = await customerSummaryQuery(profileId, conversationId)
  if (!summaries[0]) throw new NotFoundError('گفتگو پیدا نشد.')
  const messages = await sqlClient<MessageRow[]>`
    SELECT m.id, m.sender_type AS "senderType",
           CASE WHEN m.sender_type = ${SupportSenderType.Customer}
             THEN cp.preferred_name ELSE COALESCE(u.full_name, u.username, 'مدیریت کفگیر') END AS "senderName",
           m.message, m.created_at AS "createdAt", m.read_at AS "readAt"
    FROM support_messages m
    LEFT JOIN customer_profiles cp ON cp.id = m.customer_profile_id
    LEFT JOIN users u ON u.id = m.admin_user_id
    WHERE m.conversation_id = ${conversationId}
    ORDER BY m.created_at, m.id
  `
  return { ...mapSummary(summaries[0]), unreadCount: 0, messages: messages.map(mapMessage) }
}

export async function createCustomerSupportConversation(
  userId: number,
  input: CustomerSupportConversationCreateRequest,
): Promise<CustomerSupportConversationDto> {
  const profileId = await profileIdForUser(userId)
  const subjects = await sqlClient<{ id: number }[]>`
    SELECT id FROM support_subjects WHERE id = ${input.subject} AND is_active = true LIMIT 1
  `
  if (!subjects[0]) throw new AppError('موضوع انتخاب‌شده فعال نیست.')
  if (input.orderId != null) {
    const owned = await sqlClient<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM orders WHERE id = ${input.orderId}
        AND customer_profile_id = ${profileId}) AS exists
    `
    if (!owned[0]?.exists) throw new NotFoundError('سفارش انتخاب‌شده پیدا نشد.')
  }
  const conversationId = await sqlClient.begin(async (tx) => {
    const rows = await tx<{ id: number }[]>`
      INSERT INTO support_conversations
        (customer_profile_id, order_id, review_id, subject, status, last_message_at, created_at, updated_at)
      VALUES (${profileId}, ${input.orderId ?? null}, NULL, ${input.subject},
        ${SupportConversationStatus.AwaitingAdmin}, NOW(), NOW(), NOW())
      RETURNING id
    `
    const id = rows[0]!.id
    await tx`
      INSERT INTO support_messages
        (conversation_id, sender_type, customer_profile_id, admin_user_id, message, created_at)
      VALUES (${id}, ${SupportSenderType.Customer}, ${profileId}, NULL, ${input.message}, NOW())
    `
    return id
  })
  logger.info({ event: 'customer.support.created', userId, conversationId }, 'گفتگوی مشتری ایجاد شد')
  return getCustomerSupportConversation(userId, conversationId)
}

export async function addCustomerSupportMessage(
  userId: number,
  conversationId: number,
  input: SupportMessageWriteRequest,
): Promise<CustomerSupportConversationDto> {
  assertId(conversationId)
  const profileId = await profileIdForUser(userId)
  await sqlClient.begin(async (tx) => {
    const conversations = await tx<{ status: SupportConversationStatus }[]>`
      SELECT status FROM support_conversations
      WHERE id = ${conversationId} AND customer_profile_id = ${profileId} FOR UPDATE
    `
    if (!conversations[0]) throw new NotFoundError('گفتگو پیدا نشد.')
    if (conversations[0].status === SupportConversationStatus.Closed) {
      throw new AppError('این گفتگو بسته شده است؛ ابتدا آن را دوباره باز کنید.')
    }
    await tx`
      INSERT INTO support_messages
        (conversation_id, sender_type, customer_profile_id, admin_user_id, message, created_at)
      VALUES (${conversationId}, ${SupportSenderType.Customer}, ${profileId}, NULL, ${input.message}, NOW())
    `
    await tx`UPDATE support_conversations SET status = ${SupportConversationStatus.AwaitingAdmin},
      last_message_at = NOW(), updated_at = NOW() WHERE id = ${conversationId}`
  })
  return getCustomerSupportConversation(userId, conversationId)
}

export async function setCustomerSupportConversationClosed(
  userId: number,
  conversationId: number,
  closed: boolean,
): Promise<CustomerSupportConversationDto> {
  assertId(conversationId)
  const profileId = await profileIdForUser(userId)
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE support_conversations SET
      status = ${closed ? SupportConversationStatus.Closed : SupportConversationStatus.AwaitingAdmin},
      closed_at = ${closed ? new Date().toISOString() : null}, updated_at = NOW()
    WHERE id = ${conversationId} AND customer_profile_id = ${profileId}
    RETURNING id
  `
  if (!rows[0]) throw new NotFoundError('گفتگو پیدا نشد.')
  return getCustomerSupportConversation(userId, conversationId)
}

const adminSummaryQuery = async (status?: SupportConversationStatus, conversationId?: number) => sqlClient<AdminSummaryRow[]>`
  SELECT c.id, c.subject, ss.title AS "subjectTitle", c.status,
         c.customer_profile_id AS "customerProfileId",
         cp.preferred_name AS "customerName", cp.default_phone_number AS "customerPhoneNumber",
         c.order_id AS "orderId", o.order_number AS "orderNumber", c.review_id AS "reviewId",
         last_message.message AS "lastMessage", c.last_message_at AS "lastMessageAt",
         c.created_at AS "createdAt", COALESCE(unread.count, 0)::int AS "unreadCount"
  FROM support_conversations c
  JOIN support_subjects ss ON ss.id = c.subject
  JOIN customer_profiles cp ON cp.id = c.customer_profile_id
  LEFT JOIN orders o ON o.id = c.order_id
  JOIN LATERAL (
    SELECT message FROM support_messages WHERE conversation_id = c.id
    ORDER BY created_at DESC, id DESC LIMIT 1
  ) last_message ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS count FROM support_messages
    WHERE conversation_id = c.id AND sender_type = ${SupportSenderType.Customer} AND read_at IS NULL
  ) unread ON true
  WHERE (${status ?? null}::int IS NULL OR c.status = ${status ?? null})
    AND (${conversationId ?? null}::int IS NULL OR c.id = ${conversationId ?? null})
  ORDER BY (COALESCE(unread.count, 0) > 0) DESC, c.last_message_at DESC, c.id DESC
  LIMIT 200
`

export async function listAdminSupportConversations(status?: SupportConversationStatus) {
  return (await adminSummaryQuery(status)).map(mapAdminSummary)
}

export async function getAdminSupportConversation(conversationId: number): Promise<AdminSupportConversationDto> {
  assertId(conversationId)
  await sqlClient`UPDATE support_messages SET read_at = NOW()
    WHERE conversation_id = ${conversationId} AND sender_type = ${SupportSenderType.Customer} AND read_at IS NULL`
  const summary = (await adminSummaryQuery(undefined, conversationId))[0]
  if (!summary) throw new NotFoundError('گفتگو پیدا نشد.')
  const messages = await sqlClient<MessageRow[]>`
    SELECT m.id, m.sender_type AS "senderType",
           CASE WHEN m.sender_type = ${SupportSenderType.Customer}
             THEN cp.preferred_name ELSE COALESCE(u.full_name, u.username, 'مدیریت کفگیر') END AS "senderName",
           m.message, m.created_at AS "createdAt", m.read_at AS "readAt"
    FROM support_messages m
    LEFT JOIN customer_profiles cp ON cp.id = m.customer_profile_id
    LEFT JOIN users u ON u.id = m.admin_user_id
    WHERE m.conversation_id = ${conversationId}
    ORDER BY m.created_at, m.id
  `
  return { ...mapAdminSummary(summary), unreadCount: 0, messages: messages.map(mapMessage) }
}

export async function addAdminSupportMessage(
  adminUserId: number,
  conversationId: number,
  input: SupportMessageWriteRequest,
): Promise<AdminSupportConversationDto> {
  assertId(conversationId)
  await sqlClient.begin(async (tx) => {
    const conversations = await tx<{ status: SupportConversationStatus }[]>`
      SELECT status FROM support_conversations WHERE id = ${conversationId} FOR UPDATE
    `
    if (!conversations[0]) throw new NotFoundError('گفتگو پیدا نشد.')
    if (conversations[0].status === SupportConversationStatus.Closed) {
      throw new AppError('برای پاسخ‌دادن ابتدا گفتگو را دوباره باز کنید.')
    }
    await tx`
      INSERT INTO support_messages
        (conversation_id, sender_type, customer_profile_id, admin_user_id, message, created_at)
      VALUES (${conversationId}, ${SupportSenderType.Admin}, NULL, ${adminUserId}, ${input.message}, NOW())
    `
    await tx`UPDATE support_conversations SET status = ${SupportConversationStatus.AwaitingCustomer},
      last_message_at = NOW(), updated_at = NOW() WHERE id = ${conversationId}`
    await tx`INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
      VALUES ('support.reply', 'support_conversation', ${conversationId}, ${adminUserId}, NULL, NOW())`
  })
  return getAdminSupportConversation(conversationId)
}

export async function setAdminSupportConversationClosed(
  adminUserId: number,
  conversationId: number,
  closed: boolean,
): Promise<AdminSupportConversationDto> {
  assertId(conversationId)
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE support_conversations SET
      status = ${closed ? SupportConversationStatus.Closed : SupportConversationStatus.AwaitingAdmin},
      closed_at = ${closed ? new Date().toISOString() : null}, updated_at = NOW()
    WHERE id = ${conversationId} RETURNING id
  `
  if (!rows[0]) throw new NotFoundError('گفتگو پیدا نشد.')
  await sqlClient`INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES (${closed ? 'support.close' : 'support.reopen'}, 'support_conversation', ${conversationId},
      ${adminUserId}, NULL, NOW())`
  return getAdminSupportConversation(conversationId)
}

type ReviewRow = Omit<AdminOrderReviewDto, 'createdAt' | 'updatedAt'> & {
  createdAt: DbDate
  updatedAt: DbDate | null
  totalCount: number
}

/** Filters the admin review grid exposes. Every one of them narrows the count as well as the rows. */
export type AdminOrderReviewQuery = {
  handlingStatus?: OrderReviewHandlingStatus | null
  rating?: number | null
  from?: string | null
  to?: string | null
  search?: string | null
  page?: number | null
  pageSize?: number | null
}

/**
 * The admin review grid. Pages in the database rather than truncating: the previous LIMIT 200
 * silently hid older reviews once the shop accumulated more than that.
 *
 * Unrated-attention-first ordering is deliberate — new reviews, then lowest rating — so the
 * complaints an operator must act on sit at the top instead of being buried by recent praise.
 */
export async function listAdminOrderReviews(
  query: AdminOrderReviewQuery = {},
): Promise<PagedResult<AdminOrderReviewDto>> {
  const paging = resolvePaging(query.page, query.pageSize)
  const handlingStatus = query.handlingStatus ?? null
  const rating = query.rating ?? null
  const from = query.from || null
  const to = query.to || null
  const search = query.search?.trim() || null
  const rows = await sqlClient<ReviewRow[]>`
    SELECT r.id, r.order_id AS "orderId", o.order_number AS "orderNumber",
           r.customer_profile_id AS "customerProfileId", cp.preferred_name AS "customerName",
           cp.default_phone_number AS "customerPhoneNumber", r.rating, r.comment,
           r.handling_status AS "handlingStatus", c.id AS "conversationId",
           r.created_at AS "createdAt", r.updated_at AS "updatedAt",
           COUNT(*) OVER ()::int AS "totalCount"
    FROM order_reviews r
    JOIN orders o ON o.id = r.order_id
    JOIN customer_profiles cp ON cp.id = r.customer_profile_id
    LEFT JOIN support_conversations c ON c.review_id = r.id
    WHERE (${handlingStatus}::int IS NULL OR r.handling_status = ${handlingStatus})
      AND (${rating}::int IS NULL OR r.rating = ${rating})
      AND (${from}::date IS NULL OR r.created_at >= ${from}::date)
      AND (${to}::date IS NULL OR r.created_at < (${to}::date + 1))
      AND (${search}::text IS NULL
           OR o.order_number ILIKE '%'||${search}||'%'
           OR cp.preferred_name ILIKE '%'||${search}||'%'
           OR cp.default_phone_number ILIKE '%'||${search}||'%')
    ORDER BY (r.handling_status = ${OrderReviewHandlingStatus.New}) DESC, r.rating ASC,
             r.created_at DESC, r.id DESC
    LIMIT ${paging.limit} OFFSET ${paging.offset}
  `
  return pagedResult(
    rows.map(({ totalCount: _ignored, ...row }) => ({
      ...row,
      createdAt: isoDate(row.createdAt),
      updatedAt: nullableIsoDate(row.updatedAt),
    })),
    rows[0]?.totalCount ?? 0,
    paging,
  )
}

export async function setAdminOrderReviewStatus(
  adminUserId: number,
  reviewId: number,
  handlingStatus: OrderReviewHandlingStatus,
): Promise<void> {
  assertId(reviewId, 'نظر')
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE order_reviews SET handling_status = ${handlingStatus},
      admin_seen_at = CASE WHEN ${handlingStatus} >= ${OrderReviewHandlingStatus.Seen}
        THEN COALESCE(admin_seen_at, NOW()) ELSE NULL END,
      resolved_at = CASE WHEN ${handlingStatus} = ${OrderReviewHandlingStatus.Resolved} THEN NOW() ELSE NULL END,
      resolved_by_user_id = CASE WHEN ${handlingStatus} = ${OrderReviewHandlingStatus.Resolved}
        THEN ${adminUserId} ELSE NULL END
    WHERE id = ${reviewId} RETURNING id
  `
  if (!rows[0]) throw new NotFoundError('نظر پیدا نشد.')
  await sqlClient`INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES ('order_review.status', 'order_review', ${reviewId}, ${adminUserId},
      ${JSON.stringify({ handlingStatus })}, NOW())`
}

export async function replyToOrderReview(
  adminUserId: number,
  reviewId: number,
  input: SupportMessageWriteRequest,
): Promise<AdminSupportConversationDto> {
  assertId(reviewId, 'نظر')
  const conversationId = await sqlClient.begin(async (tx) => {
    const reviews = await tx<{ customerProfileId: number; orderId: number }[]>`
      SELECT customer_profile_id AS "customerProfileId", order_id AS "orderId"
      FROM order_reviews WHERE id = ${reviewId} FOR UPDATE
    `
    if (!reviews[0]) throw new NotFoundError('نظر پیدا نشد.')
    const existing = await tx<{ id: number }[]>`
      SELECT id FROM support_conversations WHERE review_id = ${reviewId} LIMIT 1
    `
    let id = existing[0]?.id
    if (!id) {
      const subjects = await tx<{ id: number }[]>`
        SELECT id FROM support_subjects WHERE system_key = 'food-quality' LIMIT 1
      `
      if (!subjects[0]) throw new AppError('موضوع سیستمی کیفیت غذا پیکربندی نشده است.')
      const inserted = await tx<{ id: number }[]>`
        INSERT INTO support_conversations
          (customer_profile_id, order_id, review_id, subject, status, last_message_at, created_at, updated_at)
        VALUES (${reviews[0].customerProfileId}, ${reviews[0].orderId}, ${reviewId},
          ${subjects[0].id},
          ${SupportConversationStatus.AwaitingCustomer}, NOW(), NOW(), NOW())
        RETURNING id
      `
      id = inserted[0]!.id
    } else {
      await tx`UPDATE support_conversations SET status = ${SupportConversationStatus.AwaitingCustomer},
        closed_at = NULL, last_message_at = NOW(), updated_at = NOW() WHERE id = ${id}`
    }
    await tx`
      INSERT INTO support_messages
        (conversation_id, sender_type, customer_profile_id, admin_user_id, message, created_at)
      VALUES (${id}, ${SupportSenderType.Admin}, NULL, ${adminUserId}, ${input.message}, NOW())
    `
    await tx`UPDATE order_reviews SET handling_status = CASE
        WHEN handling_status = ${OrderReviewHandlingStatus.Resolved} THEN handling_status
        ELSE ${OrderReviewHandlingStatus.Seen} END,
      admin_seen_at = COALESCE(admin_seen_at, NOW()) WHERE id = ${reviewId}`
    await tx`INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
      VALUES ('order_review.reply', 'order_review', ${reviewId}, ${adminUserId}, NULL, NOW())`
    return id
  })
  return getAdminSupportConversation(conversationId)
}
