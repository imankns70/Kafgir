import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCustomerToken, optionalCustomer, requireSameOrigin } from './customer-session'

describe('customer session', () => {
  beforeEach(() => {
    process.env.JWT_SIGNING_KEY = 'customer-session-test-key-with-32-characters'
  })
  afterEach(() => {
    delete process.env.JWT_SIGNING_KEY
    delete process.env.CUSTOMER_ALLOWED_ORIGINS
  })

  it('round-trips a customer token from the HttpOnly cookie value', async () => {
    const session = await createCustomerToken({ userId: 42, method: 'phone' })
    const request = new Request('http://localhost/api/auth/customer/session', {
      headers: { cookie: `kafgir_customer_session=${session.token}` },
    })
    await expect(optionalCustomer(request)).resolves.toEqual({ userId: 42, method: 'phone' })
  })

  it('does not authenticate a malformed cookie', async () => {
    const request = new Request('http://localhost/api/auth/customer/session', {
      headers: { cookie: 'kafgir_customer_session=invalid' },
    })
    await expect(optionalCustomer(request)).resolves.toBeNull()
  })

  it('accepts state-changing requests from the public tunnel origin', () => {
    const request = new Request('https://kafgir-test.pinggy.link/api/auth/customer/telegram', {
      headers: { origin: 'https://kafgir-test.pinggy.link' },
    })
    expect(() => requireSameOrigin(request)).not.toThrow()
  })

  it('accepts an explicitly configured external origin', () => {
    process.env.CUSTOMER_ALLOWED_ORIGINS = 'https://kafgir-test.pinggy.link'
    const request = new Request('http://localhost:3000/api/auth/customer/telegram', {
      headers: { origin: 'https://kafgir-test.pinggy.link' },
    })
    expect(() => requireSameOrigin(request)).not.toThrow()
  })

  it('rejects an unrelated origin', () => {
    const request = new Request('https://kafgir-test.pinggy.link/api/auth/customer/telegram', {
      headers: { origin: 'https://example.com' },
    })
    expect(() => requireSameOrigin(request)).toThrow('مبدأ درخواست معتبر نیست.')
  })

  it('accepts a browser origin when the server is bound to a different address', () => {
    // `next dev --hostname 0.0.0.0` makes Next report `request.url` as the bind address while the
    // browser sends the address it actually asked for. Comparing the two rejected every
    // same-origin POST in local development.
    const request = new Request('http://0.0.0.0:3000/api/analytics/heartbeat', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
    })
    expect(() => requireSameOrigin(request)).not.toThrow()
  })

  it('rejects an origin whose host does not match the requested host', () => {
    const request = new Request('http://0.0.0.0:3000/api/orders', {
      method: 'POST',
      headers: { origin: 'https://attacker.example', host: 'localhost:3000' },
    })
    expect(() => requireSameOrigin(request)).toThrow('مبدأ درخواست معتبر نیست.')
  })

  it('rejects a matching host reached over the wrong scheme behind a TLS proxy', () => {
    const request = new Request('https://kafgir.example/api/orders', {
      method: 'POST',
      headers: {
        origin: 'http://kafgir.example',
        host: 'kafgir.example',
        'x-forwarded-proto': 'https',
      },
    })
    expect(() => requireSameOrigin(request)).toThrow('مبدأ درخواست معتبر نیست.')
  })

  it('rejects a malformed origin header', () => {
    const request = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { origin: 'not-a-url', host: 'localhost:3000' },
    })
    expect(() => requireSameOrigin(request)).toThrow('مبدأ درخواست معتبر نیست.')
  })
})
