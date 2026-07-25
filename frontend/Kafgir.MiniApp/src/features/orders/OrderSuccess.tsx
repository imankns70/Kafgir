import type { OrderDto } from '../../types'
import { formatMoney, toPersianDigits } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'

export function OrderSuccess({ order, onBack }: { order: OrderDto; onBack: () => void }) {
  return <main className="status-card">
    <div className="success-mark"><Icon name="confirm" size="xl" /></div>
    <h1 className="section-title">سفارش شما ثبت شد</h1>
    <p>سفارش شما ثبت شد و در انتظار تایید کفگیر است.</p>
    <StatusBadge status={order.status} />
    {order.orderNumber && <p className="price">شماره سفارش: {toPersianDigits(order.orderNumber)}</p>}
    <p className="muted">مبلغ کل: {formatMoney(order.totalAmount)}</p>
    <button className="primary-button" onClick={onBack}>بازگشت به منوی امروز</button>
  </main>
}
