import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeliveryMethod, OrderStatus, PaymentMethod, type OrderDto } from '../../types'
import { OrderSuccess } from './OrderSuccess'

const order: OrderDto = {
  id: 12,
  orderNumber: '14051',
  customerId: 8,
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  addressLine: 'اندیمشک، خیابان نمونه',
  status: OrderStatus.PendingConfirmation,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Delivery,
  subtotalAmount: 381000,
  deliveryFee: 0,
  discountAmount: 0,
  totalAmount: 381000,
  customerNote: null,
  adminNote: null,
  createdAt: '2026-08-12T10:00:00.000Z',
  confirmedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  items: [{ id: 1, dailyMenuItemId: 3, foodName: 'غذای تست', unitPrice: 381000, quantity: 1, totalPrice: 381000 }],
  statusHistories: [],
}

describe('OrderSuccess', () => {
  it('shows the primary order facts and both next actions', () => {
    const html = renderToStaticMarkup(createElement(OrderSuccess, { order, onBack: () => undefined, onTrack: () => undefined }))

    expect(html).toContain('سفارشت ثبت شد!')
    expect(html).toContain('14051')
    expect(html).toContain('381,000 تومان')
    expect(html).toContain('در انتظار تأیید')
    expect(html).toContain('پیگیری سفارش')
    expect(html).toContain('مشاهده فاکتور')
    expect(html).toContain('بازگشت به منو')
  })

  it('says when the food arrives: the booked window, or express when no window was booked', () => {
    const windowed = renderToStaticMarkup(createElement(OrderSuccess, { order: {
      ...order, deliveryDate: '2026-10-08', deliveryStartTime: '14:00', deliveryEndTime: '16:00',
    }, onBack: () => undefined }))
    expect(windowed).toContain('زمان تحویل')
    expect(windowed).toContain('14:00')

    const express = renderToStaticMarkup(createElement(OrderSuccess, { order: { ...order, deliveryDate: '2026-10-08' }, onBack: () => undefined }))
    expect(express).toContain('ارسال فوری')

    // Only the summary facts: the invoice below has its own «زمان تحویل» row for every order.
    const legacy = renderToStaticMarkup(createElement(OrderSuccess, { order, onBack: () => undefined }))
    const facts = legacy.slice(legacy.indexOf('order-success-facts'), legacy.indexOf('order-success-actions'))
    expect(facts).not.toContain('زمان تحویل')
  })
})
