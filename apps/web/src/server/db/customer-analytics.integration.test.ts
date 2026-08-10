import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeDatabase,
  configureDatabase,
  getCustomerAnalyticsToday,
  recordCustomerActivity,
} from '@kafgir/server-core'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
let sql: ReturnType<typeof postgres>

integration('customer analytics PostgreSQL aggregation', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 3 })
    await sql`SELECT 1`
    await configureDatabase(connectionString!, 3)
  })

  afterAll(async () => {
    await closeDatabase()
    await sql?.end()
  })

  it('deduplicates heartbeats, associates login, and rolls over after 30 minutes', async () => {
    const visitorId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const base = new Date('2087-03-10T08:00:00.000Z')
    const users = await sql<{ id: number }[]>`
      INSERT INTO users (username, normalized_username, created_at)
      VALUES (${`analytics-${crypto.randomUUID()}`}, ${crypto.randomUUID()}, ${base})
      RETURNING id
    `
    const userId = users[0]!.id
    try {
      const first = await recordCustomerActivity({ visitorId, sessionId }, null, base)
      const throttled = await recordCustomerActivity(
        { visitorId, sessionId: first.sessionId }, null, new Date(base.getTime() + 30_000),
      )
      expect(throttled.sessionId).toBe(first.sessionId)
      const rowsAfterThrottle = await sql<{ count: number; lastSeenAt: Date }[]>`
        SELECT COUNT(*)::int AS count, MAX(last_seen_at) AS "lastSeenAt"
        FROM analytics_sessions WHERE visitor_id = ${visitorId}::uuid
      `
      expect(rowsAfterThrottle[0]?.count).toBe(1)
      expect(rowsAfterThrottle[0]?.lastSeenAt.toISOString()).toBe(base.toISOString())

      await recordCustomerActivity(
        { visitorId, sessionId: first.sessionId }, userId, new Date(base.getTime() + 60_000),
      )
      const associated = await sql<{ userId: number | null }[]>`
        SELECT user_id AS "userId" FROM analytics_sessions WHERE id = ${first.sessionId}::uuid
      `
      expect(associated[0]?.userId).toBe(userId)

      const rolled = await recordCustomerActivity(
        { visitorId, sessionId: first.sessionId }, userId,
        new Date(base.getTime() + 31 * 60_000 + 1),
      )
      expect(rolled.sessionId).not.toBe(first.sessionId)
      const sessionCount = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM analytics_sessions WHERE visitor_id = ${visitorId}::uuid
      `
      expect(sessionCount[0]?.count).toBe(2)
    } finally {
      await sql`DELETE FROM analytics_sessions WHERE visitor_id = ${visitorId}::uuid`
      await sql`DELETE FROM users WHERE id = ${userId}`
    }
  })

  it('calculates the eight metrics with business-day and online boundaries', async () => {
    const now = new Date('2098-06-17T12:00:00.000Z')
    const suffix = crypto.randomUUID()
    const visitors = Array.from({ length: 8 }, () => crypto.randomUUID())
    const bounds = await sql<{ dayStart: Date; dayEnd: Date }[]>`
      SELECT ('2098-06-17'::date AT TIME ZONE 'Asia/Tehran') AS "dayStart",
             ('2098-06-18'::date AT TIME ZONE 'Asia/Tehran') AS "dayEnd"
    `
    const dayStart = bounds[0]!.dayStart
    const at = (milliseconds: number) => new Date(dayStart.getTime() + milliseconds)
    const users = await sql<{ id: number }[]>`
      INSERT INTO users (username, normalized_username, created_at)
      VALUES
        (${`analytics-new-${suffix}`}, ${`ANALYTICS-NEW-${suffix}`}, ${at(4 * 60 * 60_000)}),
        (${`analytics-returning-${suffix}`}, ${`ANALYTICS-RETURNING-${suffix}`}, ${new Date(dayStart.getTime() - 86_400_000)})
      RETURNING id
    `
    const [newUserId, returningUserId] = users.map((row) => row.id)
    const profiles = await sql<{ id: number }[]>`
      INSERT INTO customer_profiles (user_id, preferred_name, default_phone_number, created_at)
      VALUES (${returningUserId!}, 'Analytics fixture', '09120000000', ${dayStart})
      RETURNING id
    `
    const profileId = profiles[0]!.id
    const insertSession = async (
      visitorId: string,
      startedAt: Date,
      lastSeenAt: Date,
      userId: number | null = null,
    ) => {
      await sql`
        INSERT INTO analytics_sessions (id, visitor_id, user_id, started_at, last_seen_at, created_at)
        VALUES (${crypto.randomUUID()}::uuid, ${visitorId}::uuid, ${userId}, ${startedAt}, ${lastSeenAt}, ${startedAt})
      `
    }

    try {
      // Guest visitor with repeated sessions: one unique visitor, two sessions.
      await insertSession(visitors[0]!, at(60_000), at(2 * 60 * 60_000))
      await insertSession(visitors[0]!, at(3 * 60 * 60_000), new Date(now.getTime() - 60_000))
      // One new authenticated user with multiple sessions remains one authenticated user.
      await insertSession(visitors[1]!, at(4 * 60 * 60_000), at(5 * 60 * 60_000), newUserId!)
      await insertSession(visitors[1]!, at(6 * 60 * 60_000), new Date(now.getTime() - 120_000), newUserId!)
      await insertSession(visitors[2]!, at(7 * 60 * 60_000), at(8 * 60 * 60_000), returningUserId!)
      // A guest who logs in today is authenticated, not guest-only.
      await insertSession(visitors[3]!, at(8 * 60 * 60_000), at(9 * 60 * 60_000), returningUserId!)
      // Exactly five minutes ago is online; five minutes and one second is not.
      await insertSession(visitors[4]!, at(9 * 60 * 60_000), new Date(now.getTime() - 5 * 60_000))
      await insertSession(visitors[5]!, at(10 * 60 * 60_000), new Date(now.getTime() - 5 * 60_000 - 1_000))
      // Started yesterday but active exactly at today's boundary: visitor yes, session today no.
      await insertSession(visitors[6]!, new Date(dayStart.getTime() - 60_000), dayStart)
      // Activity immediately before today's boundary must not count.
      await insertSession(visitors[7]!, new Date(dayStart.getTime() - 120_000), new Date(dayStart.getTime() - 1))

      await sql`
        INSERT INTO orders
          (order_number, customer_profile_id, delivery_full_name, delivery_phone_number,
           delivery_city, delivery_address_line, status, payment_method, delivery_method,
           subtotal_amount, delivery_fee, total_amount, created_at, analytics_visitor_id)
        VALUES
          (${`A-${suffix}-1`}, ${profileId}, 'Fixture', '09120000000', 'اندیمشک', 'Test', 1, 1, 1,
           0, 0, 0, ${at(5 * 60 * 60_000)}, ${visitors[0]!}::uuid),
          (${`A-${suffix}-2`}, ${profileId}, 'Fixture', '09120000000', 'اندیمشک', 'Test', 1, 1, 1,
           0, 0, 0, ${at(6 * 60 * 60_000)}, ${visitors[0]!}::uuid),
          (${`A-${suffix}-3`}, ${profileId}, 'Fixture', '09120000000', 'اندیمشک', 'Test', 1, 1, 1,
           0, 0, 0, ${at(7 * 60 * 60_000)}, ${visitors[1]!}::uuid)
      `

      await expect(getCustomerAnalyticsToday(now)).resolves.toMatchObject({
        uniqueVisitorsToday: 7,
        onlineNow: 3,
        guestVisitorsToday: 4,
        authenticatedUsersToday: 2,
        newUsersToday: 1,
        returningUsersToday: 1,
        sessionsToday: 8,
        conversionRate: 28.6,
      })
    } finally {
      await sql`DELETE FROM orders WHERE order_number LIKE ${`A-${suffix}-%`}`
      await sql`DELETE FROM analytics_sessions WHERE visitor_id = ANY(${visitors}::uuid[])`
      await sql`DELETE FROM customer_profiles WHERE id = ${profileId}`
      await sql`DELETE FROM users WHERE id = ANY(${users.map((row) => row.id)}::int[])`
    }
  })

  it('returns a zero conversion rate when the business day has no visitors', async () => {
    const result = await getCustomerAnalyticsToday(new Date('2081-01-01T12:00:00.000Z'))
    expect(result.uniqueVisitorsToday).toBe(0)
    expect(result.conversionRate).toBe(0)
  })
})
