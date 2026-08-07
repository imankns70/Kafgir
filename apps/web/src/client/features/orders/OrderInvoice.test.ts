import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeliveryMethod, OrderStatus, PaymentMethod, type OrderDto } from '../../types'
import { OrderInvoice } from './OrderInvoice'

const order: OrderDto = {
  id: 12,
  orderNumber: '1405123',
  customerId: 8,
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  addressLine: 'اندیمشک، خیابان نمونه',
  status: OrderStatus.PendingConfirmation,
  paymentMethod: PaymentMethod.CardToCard,
  deliveryMethod: DeliveryMethod.Delivery,
  subtotalAmount: 774000,
  deliveryFee: 0,
  totalAmount: 774000,
  customerNote: 'زنگ در خراب است.',
  adminNote: null,
  createdAt: '2026-08-01T10:00:00.000Z',
  confirmedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  items: [{ id: 1, dailyMenuItemId: 3, foodName: 'قورمه‌سبزی', unitPrice: 387000, quantity: 2, totalPrice: 774000 }],
  statusHistories: [],
}

describe('OrderInvoice', () => {
  it('renders the order number, immutable line details, address and total', () => {
    const html = renderToStaticMarkup(createElement(OrderInvoice, { order, allowPrint: false }))

    expect(html).toContain('1405123')
    expect(html).toContain('قورمه‌سبزی')
    expect(html).toContain('387,000 تومان')
    expect(html).toContain('774,000 تومان')
    expect(html).toContain('اندیمشک، خیابان نمونه')
    expect(html).not.toContain('چاپ یا ذخیره فاکتور')
  })
})
