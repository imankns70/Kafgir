import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeliveryMethod, OrderStatus, PaymentMethod, type OrderSummaryDto } from '@kafgir/contracts'
import { ReportOrderTable } from './App'

const order: OrderSummaryDto = {
  id: 4,
  orderNumber: '1405-482917',
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  status: OrderStatus.Confirmed,
  totalAmount: 975000,
  paymentMethod: PaymentMethod.Cash,
  deliveryMethod: DeliveryMethod.Delivery,
  createdAt: '2026-10-08T09:00:00.000Z',
  totalQuantity: 3,
  foodSummary: 'قورمه‌سبزی × ۳',
  deliveryDate: '2026-10-08',
  deliveryStartTime: '12:30',
  deliveryEndTime: '13:30',
}

describe('ReportOrderTable', () => {
  it('has one cell per header so every column sits under its own title', () => {
    const html = renderToStaticMarkup(createElement(ReportOrderTable, { orders: [order], rowOffset: 0, onOpen: () => undefined }))
    const headers = html.match(/<th[ >]/g)?.length ?? 0
    const cells = html.match(/<tbody>.*<\/tbody>/s)?.[0].match(/<td[ >]/g)?.length ?? 0
    expect(cells).toBe(headers)
    // The payment method sits under «نوع فروش», after the delivery window.
    expect(html.indexOf('12:30')).toBeLessThan(html.indexOf('نقدی'))
  })
})
