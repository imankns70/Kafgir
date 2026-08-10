import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createOrderMock } = vi.hoisted(() => ({ createOrderMock: vi.fn() }))

vi.mock('@/server/services/order-service', () => ({ createOrder: createOrderMock }))
vi.mock('@/server/auth/customer-session', () => ({
  optionalCustomer: vi.fn().mockResolvedValue({ userId: 42, method: 'phone' }),
  requireSameOrigin: vi.fn(),
}))
vi.mock('@/server/services/customer-auth-service', () => ({
  confirmedPhoneForUser: vi.fn().mockResolvedValue('09121234567'),
}))
vi.mock('@/server/telegram/validation', () => ({
  validateTelegramInitData: vi.fn().mockReturnValue({ valid: false, identity: null }),
}))

describe('order analytics isolation', () => {
  beforeEach(() => {
    createOrderMock.mockReset().mockResolvedValue({ id: 90, orderNumber: '140590' })
  })

  it('creates an authenticated order when analytics cookies are malformed', async () => {
    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'kafgir_visitor_id=invalid; kafgir_analytics_session=unavailable',
      },
      body: JSON.stringify({
        fullName: 'مشتری آزمایشی',
        phoneNumber: '09121234567',
        city: 'اندیمشک',
        addressLine: 'یک آدرس معتبر برای آزمایش',
        saveAddress: false,
        paymentMethod: 2,
        deliveryMethod: 1,
        customerNote: null,
        items: [{ dailyMenuItemId: 1, quantity: 1 }],
      }),
    }))

    expect(response.status).toBe(201)
    expect(createOrderMock).toHaveBeenCalledOnce()
    expect(createOrderMock.mock.calls[0]?.[5]).toBeUndefined()
  })
})
