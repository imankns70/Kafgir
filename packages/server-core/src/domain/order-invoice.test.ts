import { describe, expect, it } from 'vitest'
import { DeliveryMethod, PaymentMethod } from '@kafgir/contracts'
import { formatTelegramOrderInvoice } from './order-invoice'

describe('Telegram order invoice', () => {
  it('includes the immutable order details and totals', () => {
    const message = formatTelegramOrderInvoice({
      orderNumber: '1405123',
      createdAt: new Date('2026-08-01T10:00:00Z'),
      customerFullName: 'مشتری تست',
      customerPhoneNumber: '09120000000',
      addressLine: 'اندیمشک، خیابان نمونه',
      deliveryMethod: DeliveryMethod.Delivery,
      paymentMethod: PaymentMethod.Cash,
      subtotalAmount: 774000,
      deliveryFee: 0,
      totalAmount: 774000,
      items: [{ foodName: 'قورمه‌سبزی', unitPrice: 387000, quantity: 2 }],
    })
    expect(message).toContain('شماره سفارش: 1405123')
    expect(message).toContain('2 × 387,000 تومان = 774,000 تومان')
    expect(message).toContain('مبلغ نهایی: 774,000 تومان')
    expect(message).toContain('اندیمشک، خیابان نمونه')
    expect(message.length).toBeLessThanOrEqual(4000)
  })
})
