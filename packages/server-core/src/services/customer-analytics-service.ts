import type {
  AnalyticsHeartbeatRequest,
  AnalyticsHeartbeatResponse,
  CustomerAnalyticsTodayDto,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { businessDate } from '../time'

export const analyticsSessionInactivityMs = 30 * 60_000
export const analyticsHeartbeatWriteThrottleMs = 60_000

type DbDate = Date | string
type SessionRecord = {
  id: string
  visitorId: string
  userId: number | null
  lastSeenAt: DbDate
}

const timestamp = (value: DbDate) => new Date(value).getTime()

export function isAnalyticsSessionExpired(lastSeenAt: DbDate, now = new Date()) {
  return now.getTime() - timestamp(lastSeenAt) > analyticsSessionInactivityMs
}

export function shouldWriteAnalyticsHeartbeat(lastSeenAt: DbDate, now = new Date()) {
  return now.getTime() - timestamp(lastSeenAt) >= analyticsHeartbeatWriteThrottleMs
}

function compatibleUser(existingUserId: number | null, userId: number | null) {
  return existingUserId == null || userId == null || existingUserId === userId
}

async function touchReusableSession(
  tx: TransactionSql,
  session: SessionRecord,
  userId: number | null,
  now: Date,
) {
  const userChanged = session.userId == null && userId != null
  if (userChanged || shouldWriteAnalyticsHeartbeat(session.lastSeenAt, now)) {
    await tx`
      UPDATE analytics_sessions
      SET last_seen_at = ${now}, user_id = COALESCE(user_id, ${userId})
      WHERE id = ${session.id}
    `
  }
  return session.id
}

export async function recordCustomerActivity(
  input: AnalyticsHeartbeatRequest,
  userId: number | null,
  now = new Date(),
): Promise<AnalyticsHeartbeatResponse> {
  const sessionId = await sqlClient.begin(async (tx) => {
    const existing = await tx<SessionRecord[]>`
      SELECT id, visitor_id AS "visitorId", user_id AS "userId", last_seen_at AS "lastSeenAt"
      FROM analytics_sessions WHERE id = ${input.sessionId}::uuid LIMIT 1 FOR UPDATE
    `
    const current = existing[0]
    if (current && current.visitorId === input.visitorId &&
        compatibleUser(current.userId, userId) && !isAnalyticsSessionExpired(current.lastSeenAt, now)) {
      return touchReusableSession(tx, current, userId, now)
    }

    const preferredId = current ? crypto.randomUUID() : input.sessionId
    const inserted = await tx<{ id: string }[]>`
      INSERT INTO analytics_sessions (id, visitor_id, user_id, started_at, last_seen_at, created_at)
      VALUES (${preferredId}::uuid, ${input.visitorId}::uuid, ${userId}, ${now}, ${now}, ${now})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `
    if (inserted[0]) return inserted[0].id

    // A duplicated initial heartbeat can race before the browser receives its first cookie. Reuse
    // that exact same client-generated session when it belongs to the same visitor.
    const raced = await tx<SessionRecord[]>`
      SELECT id, visitor_id AS "visitorId", user_id AS "userId", last_seen_at AS "lastSeenAt"
      FROM analytics_sessions WHERE id = ${preferredId}::uuid LIMIT 1 FOR UPDATE
    `
    if (raced[0] && raced[0].visitorId === input.visitorId && compatibleUser(raced[0].userId, userId)) {
      return touchReusableSession(tx, raced[0], userId, now)
    }

    const fallbackId = crypto.randomUUID()
    await tx`
      INSERT INTO analytics_sessions (id, visitor_id, user_id, started_at, last_seen_at, created_at)
      VALUES (${fallbackId}::uuid, ${input.visitorId}::uuid, ${userId}, ${now}, ${now}, ${now})
    `
    return fallbackId
  })

  return { visitorId: input.visitorId, sessionId, trackedAt: now.toISOString() }
}

export async function getCustomerAnalyticsToday(now = new Date()): Promise<CustomerAnalyticsTodayDto> {
  const date = businessDate(now)
  const rows = await sqlClient<Array<Omit<CustomerAnalyticsTodayDto, 'calculatedAt'>>>`
    WITH bounds AS (
      SELECT (${date}::date AT TIME ZONE 'Asia/Tehran') AS day_start,
             ((${date}::date + 1) AT TIME ZONE 'Asia/Tehran') AS day_end
    ),
    today_visitors AS (
      SELECT DISTINCT s.visitor_id
      FROM analytics_sessions s CROSS JOIN bounds b
      WHERE s.last_seen_at >= b.day_start AND s.last_seen_at < b.day_end
    ),
    today_users AS (
      SELECT DISTINCT s.user_id
      FROM analytics_sessions s CROSS JOIN bounds b
      WHERE s.user_id IS NOT NULL
        AND s.last_seen_at >= b.day_start AND s.last_seen_at < b.day_end
    ),
    converted_visitors AS (
      SELECT DISTINCT o.analytics_visitor_id AS visitor_id
      FROM orders o CROSS JOIN bounds b
      WHERE o.analytics_visitor_id IS NOT NULL
        AND o.created_at >= b.day_start AND o.created_at < b.day_end
        AND EXISTS (SELECT 1 FROM today_visitors tv WHERE tv.visitor_id = o.analytics_visitor_id)
    ),
    totals AS (
      SELECT
        (SELECT COUNT(*)::int FROM today_visitors) AS unique_visitors,
        (SELECT COUNT(DISTINCT s.visitor_id)::int FROM analytics_sessions s
          WHERE s.last_seen_at >= ${now} - INTERVAL '5 minutes' AND s.last_seen_at <= ${now}) AS online_now,
        (SELECT COUNT(*)::int FROM today_visitors tv WHERE NOT EXISTS (
          SELECT 1 FROM analytics_sessions s CROSS JOIN bounds b
          WHERE s.visitor_id = tv.visitor_id AND s.user_id IS NOT NULL
            AND s.last_seen_at >= b.day_start AND s.last_seen_at < b.day_end
        )) AS guest_visitors,
        (SELECT COUNT(*)::int FROM today_users) AS authenticated_users,
        (SELECT COUNT(*)::int FROM today_users tu JOIN users u ON u.id = tu.user_id CROSS JOIN bounds b
          WHERE u.created_at >= b.day_start AND u.created_at < b.day_end) AS new_users,
        (SELECT COUNT(*)::int FROM today_users tu JOIN users u ON u.id = tu.user_id CROSS JOIN bounds b
          WHERE u.created_at < b.day_start) AS returning_users,
        (SELECT COUNT(*)::int FROM analytics_sessions s CROSS JOIN bounds b
          WHERE s.started_at >= b.day_start AND s.started_at < b.day_end) AS sessions_today,
        (SELECT COUNT(*)::int FROM converted_visitors) AS converted_visitors
    )
    SELECT unique_visitors AS "uniqueVisitorsToday", online_now AS "onlineNow",
           guest_visitors AS "guestVisitorsToday", authenticated_users AS "authenticatedUsersToday",
           new_users AS "newUsersToday", returning_users AS "returningUsersToday",
           sessions_today AS "sessionsToday",
           CASE WHEN unique_visitors = 0 THEN 0::float8
             ELSE ROUND((converted_visitors * 100.0 / unique_visitors)::numeric, 1)::float8 END AS "conversionRate"
    FROM totals
  `
  return {
    uniqueVisitorsToday: rows[0]?.uniqueVisitorsToday ?? 0,
    onlineNow: rows[0]?.onlineNow ?? 0,
    guestVisitorsToday: rows[0]?.guestVisitorsToday ?? 0,
    authenticatedUsersToday: rows[0]?.authenticatedUsersToday ?? 0,
    newUsersToday: rows[0]?.newUsersToday ?? 0,
    returningUsersToday: rows[0]?.returningUsersToday ?? 0,
    sessionsToday: rows[0]?.sessionsToday ?? 0,
    conversionRate: rows[0]?.conversionRate ?? 0,
    calculatedAt: now.toISOString(),
  }
}
