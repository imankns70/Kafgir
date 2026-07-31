import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCustomerToken, optionalCustomer } from './customer-session'

describe('customer session', () => {
  beforeEach(() => {
    process.env.JWT_SIGNING_KEY = 'customer-session-test-key-with-32-characters'
  })
  afterEach(() => {
    delete process.env.JWT_SIGNING_KEY
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
})
