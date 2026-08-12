import type { OrderDto } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import { OrderInvoice } from './OrderInvoice'

export function OrderSuccess({ order, onBack }: { order: OrderDto; onBack: () => void }) {
  const showInvoice = () => document.getElementById('order-success-invoice')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <main className="order-success-page">
    <section className="status-card order-success-summary">
      <div className="order-success-hero">
        <div className="success-mark"><Icon name="confirm" size="xl" /></div>
        <div className="order-success-copy">
          <p className="eyebrow"><Icon name="confirm" size="xs" /> ثبت موفق سفارش</p>
          <h1 className="section-title">سفارشت ثبت شد!</h1>
          <p>بعد از تأیید کفگیر، وضعیت سفارش در بخش «کفگیر من» به‌روزرسانی می‌شود.</p>
        </div>
      </div>
      <div className="order-success-facts">
        <div className="order-success-number"><span>شماره سفارش</span><strong><bdi dir="ltr">#{formatNumber(order.orderNumber)}</bdi></strong></div>
        <div><span>مبلغ کل</span><strong>{formatMoney(order.totalAmount)}</strong></div>
        <div><span>وضعیت</span><StatusBadge status={order.status} /></div>
      </div>
      <div className="order-success-actions">
        <button type="button" className="primary-button" onClick={showInvoice}><Icon name="orders" size="sm" />جزئیات سفارش</button>
        <button type="button" className="checkout-back-link" onClick={onBack}>بازگشت به منو <Icon name="back" size="sm" /></button>
      </div>
    </section>
    <div id="order-success-invoice" className="order-success-invoice"><OrderInvoice order={order} /></div>
  </main>
}
