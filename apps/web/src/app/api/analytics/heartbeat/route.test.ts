import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryRateLimitStore, rateLimitPolicies, setRateLimitStore } from '@/server/rate-limit'

const mocks = vi.hoisted(() => ({
  recordCustomerActivity: vi.fn(async () => ({
    visitorId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    trackedAt: new Date().toISOString(),
  })),
}))

// The barrel also carries `AppError`, which `@/server/errors` re-exports, so the original module has
// to stay in place — replacing it wholesale leaves `RateLimitError` with no base class.
vi.mock('@kafgir/server-core', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  recordCustomerActivity: mocks.recordCustomerActivity,
}))

vi.mock('@/server/auth/customer-session', () => ({
  requireSameOrigin: vi.fn(),
  optionalCustomer: vi.fn(async () => null),
}))

import { POST } from './route'

const heartbeat = (ip: string) => new Request('http://localhost/api/analytics/heartbeat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({
    visitorId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
  }),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  setRateLimitStore(null)
})

describe('analytics heartbeat rate limiting', () => {
  it('records ordinary heartbeats', async () => {
    const response = await POST(heartbeat('203.0.113.10'))
    expect(response.status).toBe(200)
    expect(mocks.recordCustomerActivity).toHaveBeenCalledTimes(1)
  })

  it('refuses further writes once one address exhausts the window', async () => {
    const limit = rateLimitPolicies.analyticsHeartbeatPerIp.limit
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await POST(heartbeat('203.0.113.11'))).status).toBe(200)
    }
    const rejected = await POST(heartbeat('203.0.113.11'))

    expect(rejected.status).toBe(429)
    expect(Number(rejected.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(mocks.recordCustomerActivity).toHaveBeenCalledTimes(limit)
  })

  it('keeps a separate budget per trusted address', async () => {
    const limit = rateLimitPolicies.analyticsHeartbeatPerIp.limit
    for (let attempt = 0; attempt < limit; attempt += 1) await POST(heartbeat('203.0.113.12'))

    expect((await POST(heartbeat('203.0.113.13'))).status).toBe(200)
  })
})
