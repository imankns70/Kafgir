import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryRateLimitStore } from './in-memory-store'
import { rateLimitKey } from './key'
import {
  rateLimitStore,
  setRateLimitStore,
  withRateLimit,
} from './index'
import type { RateLimitPolicy } from './store'

const policy: RateLimitPolicy = { name: 'test-tier', limit: 2, windowMs: 60_000 }

const request = (headers: Record<string, string> = {}) =>
  new Request('https://kafgir.example/api/thing', { method: 'POST', headers })

const ok = () => new Response('ok', { status: 200 })

beforeEach(() => {
  vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  setRateLimitStore(null)
})

describe('withRateLimit', () => {
  it('runs the handler while budget remains', async () => {
    const handler = vi.fn(ok)
    const wrapped = withRateLimit({ policy }, handler)
    const response = await wrapped(request({ 'x-forwarded-for': '203.0.113.1' }))
    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('returns 429 and stops calling the handler once the budget is spent', async () => {
    const handler = vi.fn(ok)
    const wrapped = withRateLimit({ policy }, handler)
    const caller = { 'x-forwarded-for': '203.0.113.1' }
    await wrapped(request(caller))
    await wrapped(request(caller))
    const denied = await wrapped(request(caller))

    expect(denied.status).toBe(429)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('sends Retry-After as whole seconds', async () => {
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1 } }, ok)
    const caller = { 'x-forwarded-for': '203.0.113.2' }
    await wrapped(request(caller))
    const denied = await wrapped(request(caller))

    const retryAfter = denied.headers.get('Retry-After')
    expect(retryAfter).toMatch(/^\d+$/u)
    expect(Number(retryAfter)).toBeGreaterThan(0)
    expect(Number(retryAfter)).toBeLessThanOrEqual(60)
  })

  it('uses the existing error body shape', async () => {
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1 } }, ok)
    const caller = { 'x-forwarded-for': '203.0.113.3' }
    await wrapped(request(caller))
    const body = await (await wrapped(request(caller))).json()

    expect(Object.keys(body)).toEqual(['error'])
    expect(typeof body.error).toBe('string')
  })

  it('prefers the policy message when one is set', async () => {
    const message = 'پیام اختصاصی این بخش.'
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1, message } }, ok)
    const caller = { 'x-forwarded-for': '203.0.113.4' }
    await wrapped(request(caller))
    expect((await (await wrapped(request(caller))).json()).error).toBe(message)
  })

  it('does not leak counters or thresholds in the response', async () => {
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1 } }, ok)
    const caller = { 'x-forwarded-for': '203.0.113.5' }
    await wrapped(request(caller))
    const denied = await wrapped(request(caller))

    for (const header of ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']) {
      expect(denied.headers.get(header)).toBeNull()
    }
    const body = await denied.json()
    expect(JSON.stringify(body)).not.toMatch(/\d/u)
  })

  it('separates callers by client IP', async () => {
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1 } }, ok)
    expect((await wrapped(request({ 'x-forwarded-for': '203.0.113.6' }))).status).toBe(200)
    expect((await wrapped(request({ 'x-forwarded-for': '203.0.113.6' }))).status).toBe(429)
    expect((await wrapped(request({ 'x-forwarded-for': '203.0.113.7' }))).status).toBe(200)
  })

  it('gives a spoofed forwarding chain no fresh budget', async () => {
    // Phase 1 resolves the client from the right of X-Forwarded-For, so prepending junk cannot mint
    // a new bucket. Asserted here because that is the property the limiter depends on.
    const wrapped = withRateLimit({ policy: { ...policy, limit: 1 } }, ok)
    expect((await wrapped(request({ 'x-forwarded-for': '10.0.0.1, 203.0.113.8' }))).status).toBe(200)
    expect((await wrapped(request({ 'x-forwarded-for': '10.9.9.9, 203.0.113.8' }))).status).toBe(429)
  })

  it('honours a custom identity extractor', async () => {
    const wrapped = withRateLimit(
      { policy: { ...policy, limit: 1 }, identify: (req) => req.headers.get('x-customer') ?? 'anon' },
      ok,
    )
    expect((await wrapped(request({ 'x-customer': 'one' }))).status).toBe(200)
    expect((await wrapped(request({ 'x-customer': 'one' }))).status).toBe(429)
    expect((await wrapped(request({ 'x-customer': 'two' }))).status).toBe(200)
  })

  it('passes route context through to the handler', async () => {
    const handler = vi.fn((_request: Request, context: { params: string }) =>
      new Response(context.params, { status: 200 }))
    const wrapped = withRateLimit({ policy }, handler)
    const response = await wrapped(request({ 'x-forwarded-for': '203.0.113.9' }), { params: 'slug' })
    expect(await response.text()).toBe('slug')
  })
})

describe('key derivation', () => {
  it('never stores the raw identifier', () => {
    const phone = '09121234567'
    const key = rateLimitKey('otp', phone)
    expect(key).not.toContain(phone)
    expect(key).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('is stable for the same scope and identity', () => {
    expect(rateLimitKey('otp', '09121234567')).toBe(rateLimitKey('otp', '09121234567'))
  })

  it('separates the same identity across scopes', () => {
    expect(rateLimitKey('otp', '1.2.3.4')).not.toBe(rateLimitKey('orders', '1.2.3.4'))
  })
})

describe('store singleton', () => {
  it('returns the same instance across calls', () => {
    setRateLimitStore(null)
    expect(rateLimitStore()).toBe(rateLimitStore())
  })

  it('survives module re-evaluation by living on globalThis', async () => {
    setRateLimitStore(null)
    const first = rateLimitStore()
    vi.resetModules()
    const reimported = await import('./index')
    expect(reimported.rateLimitStore()).toBe(first)
  })

  it('defaults to a non-distributed store', () => {
    setRateLimitStore(null)
    expect(rateLimitStore().isDistributed).toBe(false)
  })
})
