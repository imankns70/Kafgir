import { useState } from 'react'
import type { OrderDto } from '../../types'
import { formatDeliveryWindow, formatMoney, formatNumber, formatPersianDay } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import { OrderInvoice } from './OrderInvoice'

/** When the food arrives, from the order's own snapshot: a window, express (a date but no window), or nothing. */
function deliveryTimeText(order: OrderDto): string | null {
  if (order.deliveryDate && order.deliveryStartTime && order.deliveryEndTime) {
    return `${formatPersianDay(order.deliveryDate)}، ${formatDeliveryWindow(order.deliveryStartTime, order.deliveryEndTime)}`
  }
  return order.deliveryDate ? 'ارسال فوری' : null
}

/**
 * The page after checkout answers three questions in order: did it work, when does the food arrive,
 * and where do I follow it. The full invoice repeats the number, status and total, so on a phone it
 * waits behind «مشاهده فاکتور» instead of doubling the page; desktop keeps it open beside the summary.
 */
export function OrderSuccess({ order, onBack, onTrack }: { order: OrderDto; onBack: () => void; onTrack?: () => void }) {
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const deliveryTime = deliveryTimeText(order)

  return <main className="order-success-page">
    <section className="status-card order-success-summary">
      <div className="order-success-hero">
        <div className="success-mark"><Icon name="confirm" size="xl" /></div>
        <div className="order-success-copy">
          <p className="eyebrow"><Icon name="confirm" size="xs" /> ثبت موفق سفارش</p>
          <h1 className="section-title">سفارشت ثبت شد!</h1>
          <p>بعد از تأیید کفگیر، وضعیت سفارش در «حساب من» به‌روزرسانی می‌شود.</p>
        </div>
      </div>
      <div className="order-success-facts">
        <div className="order-success-number"><span>شماره سفارش</span><strong><bdi dir="ltr">#{formatNumber(order.orderNumber)}</bdi></strong></div>
        {deliveryTime && <div><span>زمان تحویل</span><strong>{deliveryTime}</strong></div>}
        <div><span>مبلغ کل</span><strong>{formatMoney(order.totalAmount)}</strong></div>
        <div><span>وضعیت</span><StatusBadge status={order.status} /></div>
      </div>
      <div className="order-success-actions">
        {onTrack && <button type="button" className="primary-button" onClick={onTrack}><Icon name="orders" size="sm" />پیگیری سفارش</button>}
        <button type="button" className="checkout-back-link" onClick={onBack}>بازگشت به منو <Icon name="back" size="sm" /></button>
      </div>
      <button type="button" className="order-success-invoice-toggle" aria-expanded={isInvoiceOpen} aria-controls="order-success-invoice"
        onClick={() => setIsInvoiceOpen((open) => !open)}>
        <Icon name="orders" size="sm" />{isInvoiceOpen ? 'بستن فاکتور' : 'مشاهده فاکتور'}
      </button>
    </section>
    <div id="order-success-invoice" className={`order-success-invoice${isInvoiceOpen ? ' is-open' : ''}`}><OrderInvoice order={order} /></div>
  </main>
}
