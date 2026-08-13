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
  paymentMethod: PaymentMethod.Cash,
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
    expect(html).toContain('brand-logo-symbol')
    expect(html).not.toContain('brand-logo-wordmark')
    expect(html).not.toContain('چاپ یا ذخیره فاکتور')
  })

  it('renders a dish upgraded with Persian rice as one combined row', () => {
    const upgraded: OrderDto = {
      ...order,
      subtotalAmount: 381000,
      totalAmount: 381000,
      items: [
        {
          id: 1, dailyMenuItemId: 3, foodName: 'زرشک‌پلو با مرغ (ران)',
          allowsPersianRice: true, isPersianRice: false,
          unitPrice: 351000, quantity: 1, totalPrice: 351000,
        },
        {
          id: 2, dailyMenuItemId: 4, foodName: 'برنج ایرانی',
          allowsPersianRice: false, isPersianRice: true,
          unitPrice: 30000, quantity: 1, totalPrice: 30000,
        },
      ],
    }

    const html = renderToStaticMarkup(createElement(OrderInvoice, { order: upgraded, allowPrint: false }))
    expect(html).toContain('زرشک‌پلو با مرغ (ران) (با برنج ایرانی)')
    expect(html).toContain('381,000 تومان')
    expect(html.match(/<tbody><tr/g)).toHaveLength(1)
  })
})
