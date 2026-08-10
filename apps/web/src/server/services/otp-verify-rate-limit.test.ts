import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routeError } from '../http'
import { InMemoryRateLimitStore } from '../rate-limit/in-memory-store'
import { rateLimitKey } from '../rate-limit/key'
import { rateLimitPolicies } from '../rate-limit/policies'
import { rateLimitStore, setRateLimitStore } from '../rate-limit'
import { RateLimitError, type RateLimitPolicy } from '../rate-limit/store'
import { verifyCustomerOtp } from './customer-auth-service'

/**
 * The verify limiter runs before any database access, so exhausting the store lets these assertions
 * run without a database: a refusal must be raised before `verifyCustomerOtp` reaches PostgreSQL.
 */
const exhaust = async (policy: RateLimitPolicy, identity: string) => {
  const key = rateLimitKey(policy.name, identity)
  for (let index = 0; index < policy.limit; index += 1) {
    await rateLimitStore().consume(key, policy)
  }
}

beforeEach(() => {
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  setRateLimitStore(null)
})

describe('per-IP verify limit', () => {
  it('refuses once the IP budget is spent, before touching the database', async () => {
    await exhaust(rateLimitPolicies.otpVerifyPerIp, '203.0.113.10')
    await expect(verifyCustomerOtp('09121234567', '123456', null, '203.0.113.10'))
      .rejects.toBeInstanceOf(RateLimitError)
  })

  it('allows a different IP through the same limit', async () => {
    await exhaust(rateLimitPolicies.otpVerifyPerIp, '203.0.113.11')
    // A different address is not blocked by the IP rule, so the call proceeds past the guard and
    // fails later for an unrelated reason — never with RateLimitError from the IP dimension.
    await expect(verifyCustomerOtp('09121234567', '123456', null, '203.0.113.12'))
      .rejects.not.toBeInstanceOf(RateLimitError)
  })

  it('reports a positive Retry-After', async () => {
    await exhaust(rateLimitPolicies.otpVerifyPerIp, '203.0.113.13')
    const error = await verifyCustomerOtp('09121234567', '123456', null, '203.0.113.13')
      .catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(RateLimitError)
    expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0)
    expect((error as RateLimitError).status).toBe(429)
    expect((error as RateLimitError).context).toEqual({
      policy: 'otp-verify-ip',
      operation: 'customerOtpVerify',
      storeDistributed: false,
    })
  })
})

describe('per-phone verify limit', () => {
  it('refuses once the phone budget is spent', async () => {
    await exhaust(rateLimitPolicies.otpVerifyPerPhone, '09121234567')
    await expect(verifyCustomerOtp('09121234567', '123456', null, '203.0.113.14'))
      .rejects.toBeInstanceOf(RateLimitError)
  })

  it('shares one budget across normalized variants of the same number', async () => {
    // The key is derived after normalization, so these must not each get their own allowance.
    await exhaust(rateLimitPolicies.otpVerifyPerPhone, '09121234567')
    for (const variant of ['+989121234567', '00989121234567', '۰۹۱۲۱۲۳۴۵۶۷', '0912 123 4567']) {
      await expect(verifyCustomerOtp(variant, '123456', null, '203.0.113.15'))
        .rejects.toBeInstanceOf(RateLimitError)
    }
  })

  it('does not let one phone spend another phone budget', async () => {
    await exhaust(rateLimitPolicies.otpVerifyPerPhone, '09121234567')
    await expect(verifyCustomerOtp('09129999999', '123456', null, '203.0.113.16'))
      .rejects.not.toBeInstanceOf(RateLimitError)
  })
})

describe('429 response shape', () => {
  it('carries Retry-After and no thresholds', async () => {
    const response = routeError(new RateLimitError('درخواست‌های زیادی ثبت شده است.', 42))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    for (const header of ['X-RateLimit-Limit', 'X-RateLimit-Remaining']) {
      expect(response.headers.get(header)).toBeNull()
    }
    const body = await response.json()
    expect(Object.keys(body)).toEqual(['error'])
    expect(JSON.stringify(body)).not.toMatch(/\d/u)
  })
})
