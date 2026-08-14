import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type TestCustomer = { userId: number; method: 'phone' | 'telegram' }
type TestTelegramValidation = {
  valid: boolean
  identity: { userId: number; username: string | null; firstName: string | null; lastName: string | null } | null
}

const mocks = vi.hoisted(() => ({
  requireSameOrigin: vi.fn(),
  optionalCustomer: vi.fn<() => Promise<TestCustomer | null>>(async () => ({ userId: 42, method: 'phone' })),
  requireCustomer: vi.fn<() => Promise<TestCustomer>>(async () => ({ userId: 42, method: 'phone' })),
  enforceIp: vi.fn(async (_request: Request, _group: string) => undefined),
  enforceIdentity: vi.fn(async (_group: string, _identity: string) => undefined),
  validateTelegram: vi.fn<() => TestTelegramValidation>(() => ({ valid: false, identity: null })),
  analyticsIdentifiers: vi.fn(() => null as { visitorId: string; sessionId: string } | null),
}))

vi.mock('@/server/auth/customer-session', () => ({
  requireSameOrigin: mocks.requireSameOrigin,
  optionalCustomer: mocks.optionalCustomer,
  requireCustomer: mocks.requireCustomer,
}))

vi.mock('@/server/rate-limit/customer-mutations', () => ({
  customerRateLimitIdentity: (userId: number) => `customer:${userId}`,
  telegramRateLimitIdentity: (userId: number) => `telegram:${userId}`,
  visitorRateLimitIdentity: (visitorId: string) => `visitor:${visitorId}`,
  anonymousIpRateLimitIdentity: (ip: string) => `anonymous-ip:${ip}`,
  enforceCustomerMutationIp: mocks.enforceIp,
  enforceCustomerMutationIdentity: mocks.enforceIdentity,
}))

vi.mock('@/server/services/customer-service', () => ({
  createCustomerAddress: vi.fn(async () => undefined),
  deleteCustomerAddress: vi.fn(async () => undefined),
  getCustomerProfileByUserId: vi.fn(async () => ({})),
  updateCustomerAddress: vi.fn(async () => undefined),
  updateCustomerProfile: vi.fn(async () => undefined),
}))

vi.mock('@/server/services/customer-auth-service', () => ({
  confirmedPhoneForUser: vi.fn(async () => '09121234567'),
}))

const orderServiceMocks = vi.hoisted(() => ({ createOrder: vi.fn(async () => ({ id: 1 })) }))

vi.mock('@/server/services/order-service', () => orderServiceMocks)

vi.mock('@/server/services/customer-order-service', () => ({
  getCustomerOrderDetail: vi.fn(async () => ({ id: 9, status: 5, review: null })),
  saveCustomerOrderReview: vi.fn(async () => ({ id: 3, rating: 5, comment: null })),
}))

vi.mock('@/server/services/customer-order-delivery-service', () => ({
  confirmCustomerOrderDelivered: vi.fn(async () => ({ id: 9, status: 5 })),
}))

vi.mock('@/server/telegram/validation', () => ({
  validateTelegramInitData: mocks.validateTelegram,
}))

vi.mock('@/server/analytics-request', () => ({
  analyticsIdentifiersFromRequest: mocks.analyticsIdentifiers,
}))

vi.mock('@/server/services/menu-service', () => ({
  getMenuCartSnapshotByDate: vi.fn(async () => ({ isOpen: true, items: [] })),
}))

vi.mock('@/server/services/customer-identity-service', () => ({
  resolveCustomerUserId: vi.fn(async () => 42),
}))

vi.mock('@/server/services/food-discovery-service', () => ({
  getFoodIdBySlug: vi.fn(async () => 7),
  setFoodFavorite: vi.fn(async () => ({ favorite: true })),
  setFoodLike: vi.fn(async () => ({ liked: true })),
}))

import { POST as createOrder } from './orders/route'
import { POST as cartSnapshot } from './menus/today/cart-snapshot/route'
import { PATCH as updateProfile } from './customers/me/route'
import { POST as createAddress } from './customers/me/addresses/route'
import { DELETE as deleteAddress, PUT as updateAddress } from './customers/me/addresses/[id]/route'
import { PUT as likeFood } from './foods/[slug]/like/route'
import { DELETE as removeFavorite } from './foods/[slug]/favorite/route'
import { POST as saveReview } from './customers/me/orders/[id]/review/route'
import { POST as confirmDelivered } from './customers/me/orders/[id]/delivered/route'

const jsonRequest = (path: string, method: string, body?: unknown) => new NextRequest(`http://localhost${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.optionalCustomer.mockResolvedValue({ userId: 42, method: 'phone' })
  mocks.validateTelegram.mockReturnValue({ valid: false, identity: null })
  mocks.analyticsIdentifiers.mockReturnValue(null)
})

describe('customer mutation route wiring', () => {
  it('uses customer and IP dimensions for order creation', async () => {
    const response = await createOrder(jsonRequest('/api/orders', 'POST', {
      fullName: 'مشتری تست',
      phoneNumber: '09121234567',
      city: 'اندیمشک',
      addressLine: 'نشانی کامل مشتری',
      paymentMethod: 1,
      deliveryMethod: 2,
      deliveryTimeSlotId: 3,
      items: [{ dailyMenuItemId: 1, quantity: 1, withPersianRice: false }],
    }))

    expect(response.status).toBe(201)
    expect(mocks.enforceIp).toHaveBeenCalledWith(expect.any(Request), 'order')
    expect(mocks.enforceIdentity).toHaveBeenCalledWith('order', 'customer:42')
  })

  it('uses signed Telegram identity for an order without a customer cookie', async () => {
    mocks.optionalCustomer.mockResolvedValue(null)
    mocks.validateTelegram.mockReturnValue({
      valid: true,
      identity: { userId: 777, username: 'tester', firstName: 'Test', lastName: null },
    })

    const response = await createOrder(jsonRequest('/api/orders', 'POST', {
      telegramInitData: 'signed-init-data',
      fullName: 'مشتری تلگرام',
      phoneNumber: '09121234567',
      city: 'اندیمشک',
      addressLine: 'نشانی کامل مشتری',
      paymentMethod: 1,
      deliveryMethod: 2,
      deliveryTimeSlotId: 3,
      items: [{ dailyMenuItemId: 1, quantity: 1, withPersianRice: false }],
    }))

    expect(response.status).toBe(201)
    expect(mocks.enforceIdentity).toHaveBeenCalledWith('order', 'telegram:777')
  })

  it('uses authenticated customer identity for cart reconciliation when available', async () => {
    const response = await cartSnapshot(jsonRequest('/api/menus/today/cart-snapshot', 'POST', {
      items: [{ dailyMenuItemId: 1, withPersianRice: false }],
    }))

    expect(response.status).toBe(200)
    expect(mocks.enforceIp).toHaveBeenCalledWith(expect.any(Request), 'cartSnapshot')
    expect(mocks.enforceIdentity).toHaveBeenCalledWith('cartSnapshot', 'customer:42')
  })

  it('uses VisitorId and then trusted-IP fallback for anonymous cart reconciliation', async () => {
    mocks.optionalCustomer.mockResolvedValue(null)
    mocks.analyticsIdentifiers.mockReturnValue({
      visitorId: '33333333-3333-4333-8333-333333333333',
      sessionId: '44444444-4444-4444-8444-444444444444',
    })
    await cartSnapshot(jsonRequest('/api/menus/today/cart-snapshot', 'POST', { items: [] }))
    expect(mocks.enforceIdentity).toHaveBeenLastCalledWith(
      'cartSnapshot',
      'visitor:33333333-3333-4333-8333-333333333333',
    )

    mocks.analyticsIdentifiers.mockReturnValue(null)
    await cartSnapshot(new NextRequest('http://localhost/api/menus/today/cart-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.30' },
      body: JSON.stringify({ items: [] }),
    }))
    expect(mocks.enforceIdentity).toHaveBeenLastCalledWith('cartSnapshot', 'anonymous-ip:203.0.113.30')
  })

  it('protects profile and all address writes with the shared account policy', async () => {
    const address = {
      title: 'خانه',
      city: 'اندیمشک',
      addressLine: 'نشانی کامل مشتری تست',
      isDefault: true,
    }
    const context = { params: Promise.resolve({ id: '5' }) }

    const responses = await Promise.all([
      updateProfile(jsonRequest('/api/customers/me', 'PATCH', { preferredName: 'مشتری تست' })),
      createAddress(jsonRequest('/api/customers/me/addresses', 'POST', address)),
      updateAddress(jsonRequest('/api/customers/me/addresses/5', 'PUT', address), context),
      deleteAddress(jsonRequest('/api/customers/me/addresses/5', 'DELETE'), context),
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 201, 200, 200])
    expect(mocks.enforceIp).toHaveBeenCalledTimes(4)
    expect(mocks.enforceIdentity).toHaveBeenCalledTimes(4)
    for (const call of mocks.enforceIp.mock.calls) expect(call[1]).toBe('customerAccount')
    for (const call of mocks.enforceIdentity.mock.calls) expect(call).toEqual(['customerAccount', 'customer:42'])
  })

  it('refuses a customer order that names no delivery window', async () => {
    const response = await createOrder(jsonRequest('/api/orders', 'POST', {
      fullName: 'مشتری تست',
      phoneNumber: '09121234567',
      city: 'اندیمشک',
      addressLine: 'نشانی کامل مشتری',
      paymentMethod: 1,
      deliveryMethod: 2,
      items: [{ dailyMenuItemId: 1, quantity: 1, withPersianRice: false }],
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'برای ثبت سفارش، یک بازه زمانی تحویل انتخاب کنید.',
    })
    expect(orderServiceMocks.createOrder).not.toHaveBeenCalled()
  })

  it('protects review and delivery confirmation with the shared feedback policy', async () => {
    const context = { params: Promise.resolve({ id: '9' }) }
    const responses = await Promise.all([
      saveReview(jsonRequest('/api/customers/me/orders/9/review', 'POST', { rating: 5, comment: null }), context),
      confirmDelivered(jsonRequest('/api/customers/me/orders/9/delivered', 'POST'), context),
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(mocks.requireSameOrigin).toHaveBeenCalledTimes(2)
    for (const call of mocks.enforceIp.mock.calls) expect(call[1]).toBe('orderFeedback')
    for (const call of mocks.enforceIdentity.mock.calls) expect(call).toEqual(['orderFeedback', 'customer:42'])
  })

  it('protects like and favorite mutations with the shared interaction policy', async () => {
    const context = { params: Promise.resolve({ slug: 'test-food' }) }
    const responses = await Promise.all([
      likeFood(jsonRequest('/api/foods/test-food/like', 'PUT', {}), context),
      removeFavorite(jsonRequest('/api/foods/test-food/favorite', 'DELETE', {}), context),
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(mocks.requireSameOrigin).toHaveBeenCalledTimes(2)
    expect(mocks.enforceIp).toHaveBeenCalledTimes(2)
    expect(mocks.enforceIdentity).toHaveBeenCalledTimes(2)
    for (const call of mocks.enforceIp.mock.calls) expect(call[1]).toBe('foodInteraction')
    for (const call of mocks.enforceIdentity.mock.calls) expect(call).toEqual(['foodInteraction', 'customer:42'])
  })
})
