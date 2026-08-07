import { afterEach, describe, expect, it } from 'vitest'
import { POST } from './route'

afterEach(() => {
  delete process.env.TELEGRAM_REQUIRE_INIT_DATA
  delete process.env.TELEGRAM_BOT_TOKEN
})

describe('customer order authentication', () => {
  it('requires phone or Telegram authentication even when development fallback is enabled', async () => {
    process.env.TELEGRAM_REQUIRE_INIT_DATA = 'false'
    const response = await POST(new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'مشتری آزمایشی',
        phoneNumber: '09121234567',
        city: 'اندیمشک',
        addressLine: 'یک آدرس معتبر برای آزمایش',
        saveAddress: true,
        paymentMethod: 2,
        deliveryMethod: 1,
        customerNote: null,
        items: [{ dailyMenuItemId: 1, quantity: 1 }],
      }),
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: 'برای ثبت سفارش، ابتدا با شماره موبایل وارد شوید یا برنامه را از داخل تلگرام باز کنید.',
    })
  })
})
