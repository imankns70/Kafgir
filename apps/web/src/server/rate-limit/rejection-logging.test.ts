import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../logging/logger', () => ({
  logger: { warn: mocks.warn, error: mocks.error },
  errorFields: (error: unknown) => ({ errorMessage: String(error) }),
}))

import { routeError } from '../http'
import { InMemoryRateLimitStore } from './in-memory-store'
import { setRateLimitStore, withRateLimit } from './index'
import { logRateLimitRejection, type RateLimitRejectionMetadata } from './observability'
import { RateLimitError, type RateLimitPolicy } from './store'

const policy: RateLimitPolicy = {
  name: 'test-customer-write',
  limit: 1,
  windowMs: 60_000,
}

beforeEach(() => {
  mocks.warn.mockClear()
  mocks.error.mockClear()
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  setRateLimitStore(null)
})

describe('rate-limit rejection observability', () => {
  it('emits only the stable event and allowlisted safe metadata', () => {
    const unsafeRuntimeInput = {
      policy: 'customer-order-identity',
      operation: 'order',
      retryAfterSeconds: 17,
      storeDistributed: false,
      rawIp: '203.0.113.99',
      phoneNumber: '09121234567',
      otp: '123456',
      customerId: 98765,
      token: 'secret-token',
      requestBody: { private: 'value' },
    } as RateLimitRejectionMetadata

    logRateLimitRejection(unsafeRuntimeInput)

    expect(mocks.warn).toHaveBeenCalledOnce()
    const [fields, message] = mocks.warn.mock.calls[0]!
    expect(fields).toEqual({
      event: 'rate_limit.rejected',
      status: 429,
      policy: 'customer-order-identity',
      operation: 'order',
      retryAfterSeconds: 17,
      storeDistributed: false,
    })
    expect(message).toBe('درخواست به دلیل محدودیت نرخ رد شد')
    expect(JSON.stringify(fields)).not.toMatch(/203\.0\.113\.99|09121234567|123456|98765|secret-token|private/u)
  })

  it('logs contextual service rejections while preserving the existing 429 response', async () => {
    const response = routeError(new RateLimitError('کمی بعد دوباره تلاش کنید.', 23, {
      policy: 'otp-verify-phone',
      operation: 'customerOtpVerify',
      storeDistributed: false,
    }))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('23')
    expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'rate_limit.rejected',
      policy: 'otp-verify-phone',
      operation: 'customerOtpVerify',
      retryAfterSeconds: 23,
      storeDistributed: false,
    }), expect.any(String))
  })

  it('keeps allowed wrapper requests silent and logs only the rejection', async () => {
    const handler = vi.fn(() => new Response('ok'))
    const wrapped = withRateLimit({ policy, operation: 'testOperation' }, handler)
    const request = new Request('https://kafgir.example/api/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.20' },
    })

    expect((await wrapped(request)).status).toBe(200)
    expect(mocks.warn).not.toHaveBeenCalled()

    const rejected = await wrapped(request)
    expect(rejected.status).toBe(429)
    expect(rejected.headers.get('Retry-After')).toMatch(/^\d+$/u)
    expect(handler).toHaveBeenCalledOnce()
    expect(mocks.warn).toHaveBeenCalledWith({
      event: 'rate_limit.rejected',
      status: 429,
      policy: 'test-customer-write',
      operation: 'testOperation',
      retryAfterSeconds: expect.any(Number),
      storeDistributed: false,
    }, expect.any(String))
  })
})
