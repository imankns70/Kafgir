import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import postgres from 'postgres'
import { closeDatabase, configureDatabase } from '@kafgir/server-core'
import { InMemoryRateLimitStore } from '../rate-limit/in-memory-store'
import { setRateLimitStore } from '../rate-limit'
import { RateLimitError } from '../rate-limit/store'

const sendCustomerOtp = vi.hoisted(() => vi.fn(async (_phone: string, _code: string) => {}))
vi.mock('../services/sms-service', () => ({ sendCustomerOtp }))

const { requestCustomerOtp, verifyCustomerOtp } = await import('../services/customer-auth-service')

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)

const phone = '09121234567'
const ip = '203.0.113.20'

let sql: ReturnType<typeof postgres>

/** Ages every challenge for a phone so a later window looks elapsed. */
const ageChallenges = (target: string, interval: string) =>
  sql`UPDATE customer_otp_challenges
      SET created_at = created_at - ${interval}::interval
      WHERE normalized_phone_number = ${target}`

const challengeCount = async (target: string) =>
  Number((await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM customer_otp_challenges
    WHERE normalized_phone_number = ${target}`)[0]!.count)

integration.sequential('OTP rate limiting', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 8, prepare: false })
    await configureDatabase(connectionString!, 8)
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM customer_otp_challenges`
    await sql.end()
    await closeDatabase()
  })

  beforeEach(async () => {
    sendCustomerOtp.mockClear()
    sendCustomerOtp.mockImplementation(async () => {})
    setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
    await sql`DELETE FROM customer_otp_challenges`
  })

  afterEach(() => {
    setRateLimitStore(null)
  })

  describe('send: per phone', () => {
    it('accepts the first request and calls the provider once', async () => {
      await requestCustomerOtp(phone, ip)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(1)
      expect(await challengeCount(phone)).toBe(1)
    })

    it('blocks a resend inside the 60 second cooldown', async () => {
      await requestCustomerOtp(phone, ip)
      sendCustomerOtp.mockClear()
      const error = await requestCustomerOtp(phone, ip).catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0)
      expect((error as RateLimitError).retryAfterSeconds).toBeLessThanOrEqual(60)
      expect(sendCustomerOtp).not.toHaveBeenCalled()
      expect(await challengeCount(phone)).toBe(1)
    })

    it('allows a resend once the cooldown has elapsed', async () => {
      await requestCustomerOtp(phone, ip)
      await ageChallenges(phone, '61 seconds')
      await requestCustomerOtp(phone, ip)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(2)
    })

    it('allows three sends per ten minutes and refuses the fourth', async () => {
      for (let index = 0; index < 3; index += 1) {
        await requestCustomerOtp(phone, ip)
        await ageChallenges(phone, '61 seconds')
      }
      await expect(requestCustomerOtp(phone, ip)).rejects.toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(3)
    })

    it('allows ten sends per day and refuses the eleventh', async () => {
      for (let index = 0; index < 10; index += 1) {
        await requestCustomerOtp(phone, ip)
        // Past the cooldown and the ten-minute window, but still inside the 24 hour window.
        await ageChallenges(phone, '11 minutes')
      }
      const error = await requestCustomerOtp(phone, ip).catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(10)
    })

    it('shares one quota across normalized variants of the same number', async () => {
      await requestCustomerOtp('+989121234567', ip)
      sendCustomerOtp.mockClear()
      await expect(requestCustomerOtp('۰۹۱۲۱۲۳۴۵۶۷', ip)).rejects.toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).not.toHaveBeenCalled()
    })
  })

  describe('send: per IP', () => {
    it('allows ten sends per ten minutes from one address', async () => {
      for (let index = 0; index < 10; index += 1) {
        await requestCustomerOtp(`0912123456${index}`, ip)
      }
      await expect(requestCustomerOtp('09129999999', ip)).rejects.toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(10)
    })

    it('allows thirty sends per hour from one address', async () => {
      for (let index = 0; index < 30; index += 1) {
        await requestCustomerOtp(`0912${String(1000000 + index).slice(-7)}`, ip)
        // Clears the ten-minute IP window while staying inside the hour.
        if ((index + 1) % 10 === 0) await sql`UPDATE customer_otp_challenges
          SET created_at = created_at - INTERVAL '11 minutes' WHERE request_ip_digest IS NOT NULL`
      }
      await expect(requestCustomerOtp('09128888888', ip)).rejects.toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(30)
    })

    it('does not let one address consume another address quota', async () => {
      for (let index = 0; index < 10; index += 1) {
        await requestCustomerOtp(`0912123456${index}`, ip)
      }
      await expect(requestCustomerOtp('09127777777', '203.0.113.99')).resolves.toBeUndefined()
    })
  })

  describe('send: concurrency', () => {
    it('reserves exactly one send when requests arrive together', async () => {
      // Without the advisory lock every caller reads the same pre-insert count and all of them pass.
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, () => requestCustomerOtp(phone, ip)),
      )
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(1)
      expect(await challengeCount(phone)).toBe(1)
    })

    it('cannot bypass the per-IP quota by racing different phone numbers', async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          requestCustomerOtp(`0913${String(1_000_000 + index).slice(-7)}`, ip)),
      )
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(10)
      expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(10)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(10)
      const rows = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM customer_otp_challenges
      `
      expect(rows[0]!.count).toBe(10)
    })
  })

  describe('send: provider failure', () => {
    it('keeps the reservation so a failing provider cannot be retried without limit', async () => {
      sendCustomerOtp.mockImplementation(async () => { throw new Error('provider down') })
      await expect(requestCustomerOtp(phone, ip)).rejects.toThrow('provider down')
      expect(await challengeCount(phone)).toBe(1)

      sendCustomerOtp.mockImplementation(async () => {})
      await expect(requestCustomerOtp(phone, ip)).rejects.toBeInstanceOf(RateLimitError)
      expect(sendCustomerOtp).toHaveBeenCalledTimes(1)
    })

    it('reports delivery failure distinguishably from a refusal', async () => {
      sendCustomerOtp.mockImplementation(async () => { throw new Error('provider down') })
      const failure = await requestCustomerOtp(phone, ip).catch((reason: unknown) => reason)
      expect(failure).toBeInstanceOf(Error)
      expect(failure).not.toBeInstanceOf(RateLimitError)
    })
  })

  describe('verify', () => {
    /** Reads the code back out is impossible by design, so tests drive the digest path directly. */
    const requestAndReadChallengeId = async (target: string) => {
      await requestCustomerOtp(target, ip)
      const rows = await sql<{ id: number }[]>`
        SELECT id FROM customer_otp_challenges
        WHERE normalized_phone_number = ${target} ORDER BY created_at DESC LIMIT 1`
      return rows[0]!.id
    }

    it('rejects a wrong code and counts the attempt', async () => {
      const id = await requestAndReadChallengeId(phone)
      await expect(verifyCustomerOtp(phone, '000000', null, ip)).rejects.toThrow()
      const rows = await sql<{ attempts: number }[]>`
        SELECT attempts FROM customer_otp_challenges WHERE id = ${id}`
      expect(rows[0]!.attempts).toBe(1)
    })

    it('locks the challenge after five wrong codes and requires a new one', async () => {
      const id = await requestAndReadChallengeId(phone)
      let finalError: unknown
      for (let index = 0; index < 5; index += 1) {
        finalError = await verifyCustomerOtp(phone, '000000', null, ip)
          .catch((reason: unknown) => reason)
      }
      expect(finalError).toBeInstanceOf(RateLimitError)
      expect((finalError as RateLimitError).retryAfterSeconds).toBeGreaterThan(0)
      const rows = await sql<{ attempts: number; consumedAt: Date | null }[]>`
        SELECT attempts, consumed_at AS "consumedAt" FROM customer_otp_challenges WHERE id = ${id}`
      expect(rows[0]!.attempts).toBe(5)
      expect(rows[0]!.consumedAt).not.toBeNull()

      // A locked challenge is gone: further attempts read as expired, not as another guess.
      await expect(verifyCustomerOtp(phone, '000000', null, ip)).rejects.toThrow(/منقضی/u)
    })

    it('rejects a code once its challenge has expired', async () => {
      await requestCustomerOtp(phone, ip)
      await sql`UPDATE customer_otp_challenges SET expires_at = NOW() - INTERVAL '1 second'
                WHERE normalized_phone_number = ${phone}`
      await expect(verifyCustomerOtp(phone, '000000', null, ip)).rejects.toThrow(/منقضی/u)
    })

    it('rejects verification when no challenge was ever requested', async () => {
      await expect(verifyCustomerOtp('09125556677', '000000', null, ip)).rejects.toThrow(/منقضی/u)
    })

    it('consumes a successful code so it cannot be reused', async () => {
      await requestCustomerOtp(phone, ip)
      const deliveredCode = sendCustomerOtp.mock.calls[0]?.[1]
      expect(deliveredCode).toMatch(/^\d{6}$/u)
      await expect(verifyCustomerOtp(phone, deliveredCode!, null, ip)).resolves.toBeTypeOf('number')
      await expect(verifyCustomerOtp(phone, deliveredCode!, null, ip)).rejects.toThrow(/منقضی/u)
    })
  })
})
