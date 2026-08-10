import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PaymentStatus } from '@kafgir/contracts'
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  type CustomerOrderDetailDto,
  type CustomerOrdersPageDto,
} from '../../types'
import { CustomerOrderDetails, CustomerOrdersList, OrderProgress } from './CustomerOrders'

const activeSummary: CustomerOrdersPageDto['items'][number] = {
  id: 10,
  orderNumber: '1405123',
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  status: OrderStatus.Confirmed,
  totalAmount: 485000,
  paymentMethod: PaymentMethod.CardToCard,
  paymentStatus: PaymentStatus.AwaitingVerification,
  deliveryMethod: DeliveryMethod.Delivery,
  deliveryCity: 'اندیمشک',
  addressLine: 'خیابان نمونه، پلاک ۱۲',
  createdAt: '2026-08-09T08:00:00.000Z',
  totalQuantity: 2,
  foodSummary: 'قورمه‌سبزی × ۲',
  statusHistories: [{
    fromStatus: OrderStatus.PendingConfirmation,
    toStatus: OrderStatus.Confirmed,
    note: null,
    changedAt: '2026-08-09T08:05:00.000Z',
  }],
  review: null,
}

const detail: CustomerOrderDetailDto = {
  id: 10,
  orderNumber: '1405123',
  customerFullName: 'مشتری تست',
  customerPhoneNumber: '09120000000',
  deliveryCity: 'اندیمشک',
  addressLine: 'خیابان نمونه، پلاک ۱۲',
  status: OrderStatus.Delivered,
  paymentMethod: PaymentMethod.Online,
  deliveryMethod: DeliveryMethod.Delivery,
  subtotalAmount: 475000,
  deliveryFee: 10000,
  totalAmount: 485000,
  customerNote: null,
  createdAt: '2026-08-09T08:00:00.000Z',
  confirmedAt: '2026-08-09T08:05:00.000Z',
  deliveredAt: '2026-08-09T10:00:00.000Z',
  cancelledAt: null,
  items: [{ id: 1, dailyMenuItemId: 2, foodName: 'قورمه‌سبزی', unitPrice: 475000, quantity: 1, totalPrice: 475000 }],
  statusHistories: [
    { fromStatus: OrderStatus.PendingConfirmation, toStatus: OrderStatus.Confirmed, note: null, changedAt: '2026-08-09T08:05:00.000Z' },
    { fromStatus: OrderStatus.Confirmed, toStatus: OrderStatus.Delivered, note: null, changedAt: '2026-08-09T10:00:00.000Z' },
  ],
  payments: [{
    paymentMethod: PaymentMethod.Online,
    status: PaymentStatus.Paid,
    amount: 485000,
    providerName: 'درگاه آزمایشی',
    trackingNumber: '827361',
    referenceNumber: 'REF-1122',
    paidAt: '2026-08-09T08:07:00.000Z',
    createdAt: '2026-08-09T08:06:00.000Z',
  }],
  review: null,
}

describe('customer order history presentation', () => {
  it('renders persisted total, address snapshot, payment and actual progress', () => {
    const page: CustomerOrdersPageDto = { items: [activeSummary], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }
    const html = renderToStaticMarkup(createElement(CustomerOrdersList, {
      orders: page, onOpen: () => undefined, onReview: () => undefined,
      onPage: () => undefined, onBrowse: () => undefined,
    }))
    expect(html).toContain('485,000 تومان')
    expect(html).toContain('خیابان نمونه، پلاک ۱۲')
    expect(html).toContain('در انتظار تأیید')
    expect(html).toContain('تأیید سفارش')
  })

  it('does not invent timestamps for timeline steps that never occurred', () => {
    const html = renderToStaticMarkup(createElement(OrderProgress, { order: activeSummary }))
    expect(html).toContain('در حال آماده‌سازی')
    expect(html.match(/<time/g)?.length).toBe(2)
  })

  it('renders safe online transaction fields and historical item prices', () => {
    const html = renderToStaticMarkup(createElement(CustomerOrderDetails, {
      order: detail, onBack: () => undefined, onReview: () => undefined,
    }))
    expect(html).toContain('475,000 تومان')
    expect(html).toContain('درگاه آزمایشی')
    expect(html).toContain('827361')
    expect(html).toContain('REF-1122')
    expect(html).not.toContain('receiptImageUrl')
    expect(html).not.toContain('financialAccountId')
  })

  it('does not show irrelevant gateway fields for cash without a transaction', () => {
    const html = renderToStaticMarkup(createElement(CustomerOrderDetails, {
      order: { ...detail, paymentMethod: PaymentMethod.Cash, payments: [] },
      onBack: () => undefined, onReview: () => undefined,
    }))
    expect(html).toContain('پرداخت هنگام تحویل انجام می‌شود')
    expect(html).not.toContain('شماره مرجع')
  })

  it('shows a useful empty state', () => {
    const html = renderToStaticMarkup(createElement(CustomerOrdersList, {
      orders: { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      onOpen: () => undefined, onReview: () => undefined, onPage: () => undefined, onBrowse: () => undefined,
    }))
    expect(html).toContain('هنوز سفارشی ثبت نکرده‌اید')
    expect(html).toContain('مشاهده منوی امروز')
  })
})
