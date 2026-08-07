import type { OrderDto } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import { OrderInvoice } from './OrderInvoice'

export function OrderSuccess({ order, onBack }: { order: OrderDto; onBack: () => void }) {
  return <main className="order-success-page">
    <section className="status-card order-success-summary">
      <div className="success-mark"><Icon name="confirm" size="xl" /></div>
      <h1 className="section-title">سفارش شما ثبت شد</h1>
      <p>سفارش ثبت شد و در انتظار تایید کفگیر است.</p>
      <StatusBadge status={order.status} />
      <p className="order-success-number"><span>شماره سفارش</span><strong><bdi dir="ltr">{formatNumber(order.orderNumber)}</bdi></strong></p>
      <p className="muted">مبلغ کل: {formatMoney(order.totalAmount)}</p>
    </section>
    <OrderInvoice order={order} />
    <div className="order-success-actions"><button className="checkout-back-link" onClick={onBack}>بازگشت به منوی امروز <Icon name="back" size="sm" /></button></div>
  </main>
}
