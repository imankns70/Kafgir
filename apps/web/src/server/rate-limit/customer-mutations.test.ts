import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routeError } from '../http'
import {
  anonymousIpRateLimitIdentity,
  customerMutationPolicies,
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
  visitorRateLimitIdentity,
  type CustomerMutationGroup,
} from './customer-mutations'
import { InMemoryRateLimitStore, setRateLimitStore } from './index'
import { RateLimitError } from './store'

const requestFrom = (ip: string) => new Request('https://kafgir.example/api/customer-write', {
  method: 'POST',
  headers: { 'x-forwarded-for': ip },
})

async function attempt(group: CustomerMutationGroup, ip: string, identity: string) {
  await enforceCustomerMutationIp(requestFrom(ip), group)
  await enforceCustomerMutationIdentity(group, identity)
}

beforeEach(() => {
  vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  setRateLimitStore(null)
})

describe('customer mutation policies', () => {
  it('keeps the approved limits centralized', () => {
    expect(customerMutationPolicies.order.identity).toMatchObject({ limit: 5, windowMs: 60_000 })
    expect(customerMutationPolicies.order.ip).toMatchObject({ limit: 20, windowMs: 60_000 })
    expect(customerMutationPolicies.cartSnapshot.identity).toMatchObject({ limit: 120, windowMs: 60_000 })
    expect(customerMutationPolicies.cartSnapshot.ip).toMatchObject({ limit: 300, windowMs: 60_000 })
    expect(customerMutationPolicies.customerAccount.identity).toMatchObject({ limit: 30, windowMs: 600_000 })
    expect(customerMutationPolicies.customerAccount.ip).toMatchObject({ limit: 120, windowMs: 600_000 })
    expect(customerMutationPolicies.foodInteraction.identity).toMatchObject({ limit: 60, windowMs: 60_000 })
    expect(customerMutationPolicies.foodInteraction.ip).toMatchObject({ limit: 180, windowMs: 60_000 })
  })

  it('allows five legitimate checkout attempts and then limits that customer', async () => {
    const identity = customerRateLimitIdentity(101)
    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      await expect(attempt('order', '203.0.113.10', identity)).resolves.toBeUndefined()
    }
    const rejected = await attempt('order', '203.0.113.10', identity).catch((error: unknown) => error)
    expect(rejected).toBeInstanceOf(RateLimitError)
    expect((rejected as RateLimitError).context).toEqual({
      policy: 'customer-order-identity',
      operation: 'order',
      storeDistributed: false,
    })
  })

  it('does not share an order identity bucket between customers', async () => {
    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      await attempt('order', '203.0.113.11', customerRateLimitIdentity(201))
    }
    await expect(attempt('order', '203.0.113.11', customerRateLimitIdentity(202))).resolves.toBeUndefined()
  })

  it('enforces the order IP safety bucket independently of customer identities', async () => {
    for (let attemptNumber = 1; attemptNumber <= 20; attemptNumber += 1) {
      await attempt('order', '203.0.113.12', customerRateLimitIdentity(attemptNumber))
    }
    await expect(attempt('order', '203.0.113.12', customerRateLimitIdentity(21)))
      .rejects.toBeInstanceOf(RateLimitError)
  })

  it('leaves enough cart budget for normal quantity interaction', async () => {
    const identity = visitorRateLimitIdentity('11111111-1111-4111-8111-111111111111')
    for (let attemptNumber = 0; attemptNumber < 120; attemptNumber += 1) {
      await attempt('cartSnapshot', '203.0.113.13', identity)
    }
    await expect(attempt('cartSnapshot', '203.0.113.13', identity)).rejects.toBeInstanceOf(RateLimitError)
  })

  it('shares the moderate account-write budget across profile and address mutations', async () => {
    const identity = customerRateLimitIdentity(301)
    for (let attemptNumber = 0; attemptNumber < 30; attemptNumber += 1) {
      await attempt('customerAccount', '203.0.113.14', identity)
    }
    await expect(attempt('customerAccount', '203.0.113.14', identity))
      .rejects.toBeInstanceOf(RateLimitError)
  })

  it('protects repeated like and favorite mutations without an aggressive limit', async () => {
    const identity = customerRateLimitIdentity(401)
    for (let attemptNumber = 0; attemptNumber < 60; attemptNumber += 1) {
      await attempt('foodInteraction', '203.0.113.15', identity)
    }
    await expect(attempt('foodInteraction', '203.0.113.15', identity))
      .rejects.toBeInstanceOf(RateLimitError)
  })

  it('keeps authenticated, visitor, and anonymous fallback identities distinct', async () => {
    const identities = [
      customerRateLimitIdentity(501),
      visitorRateLimitIdentity('22222222-2222-4222-8222-222222222222'),
      anonymousIpRateLimitIdentity('203.0.113.16'),
    ]
    for (const identity of identities) {
      await expect(enforceCustomerMutationIdentity('order', identity)).resolves.toBeUndefined()
    }
  })

  it('uses the existing 429 body and includes Retry-After without exposing counters', async () => {
    const identity = customerRateLimitIdentity(601)
    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      await enforceCustomerMutationIdentity('order', identity)
    }

    let error: unknown
    try {
      await enforceCustomerMutationIdentity('order', identity)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(RateLimitError)

    const response = routeError(error)
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(response.headers.get('X-RateLimit-Limit')).toBeNull()
    expect(Object.keys(await response.json())).toEqual(['error'])
  })
})
