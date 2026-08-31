import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeliveryMethod, OrderStatus, PaymentMethod, type OrderDto } from '@kafgir/contracts'
import { AdminThermalReceipt } from './App'

const order: OrderDto = {
  id: 12,
  orderNumber: '1405123',
  customerId: 8,
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  addressLine: 'اندیمشک، خیابان نمونه',
  status: OrderStatus.PendingConfirmation,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Delivery,
  subtotalAmount: 774000,
  deliveryFee: 50000,
  totalAmount: 824000,
  customerNote: 'زنگ در خراب است.',
  adminNote: null,
  createdAt: '2026-08-01T10:00:00.000Z',
  confirmedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  items: [{ id: 1, dailyMenuItemId: 3, foodName: 'قورمه‌سبزی', unitPrice: 387000, quantity: 2, totalPrice: 774000 }],
  statusHistories: [],
}

describe('AdminThermalReceipt', () => {
  it('keeps customer, fulfillment, line and total details in the compact receipt', () => {
    const html = renderToStaticMarkup(createElement(AdminThermalReceipt, { order }))

    expect(html).toContain('رسید فروش غذای خانگی')
    expect(html).toContain('1405123')
    expect(html).toContain('مشتری تست')
    expect(html).toContain('اندیمشک، خیابان نمونه')
    expect(html).toContain('قورمه‌سبزی')
    expect(html).toContain('50,000 تومان')
    expect(html).toContain('824,000 تومان')
    expect(html).toContain('زنگ در خراب است.')
    expect(html).not.toContain('<img')
  })
})
