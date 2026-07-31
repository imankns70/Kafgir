import type { CartItem } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { Icon } from '../../design-system/Icon'

export function CartSummary({ items, onQuantityChange }: { items: CartItem[]; onQuantityChange: (id: number, quantity: number) => void }) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  return <section className="panel">
    <h2 className="section-title">سبد خرید</h2>
    {items.length === 0 && <p className="muted">سبد خرید شما خالی است.</p>}
    {items.map((item) => <div className="cart-row" key={item.dailyMenuItemId}>
      <div><div className="cart-name">{item.foodName}</div><small className="muted">{formatMoney(item.unitPrice)} × {formatNumber(item.quantity)}</small></div>
      <div className="quantity-controls">
        <button type="button" className="quantity-button" aria-label={`کم کردن تعداد ${item.foodName}`} onClick={() => onQuantityChange(item.dailyMenuItemId, item.quantity - 1)}><Icon name="minus" size="sm" /></button>
        <strong>{formatNumber(item.quantity)}</strong>
        <button type="button" className="quantity-button" aria-label={`اضافه کردن تعداد ${item.foodName}`} disabled={item.quantity >= item.remainingPortions}
          onClick={() => onQuantityChange(item.dailyMenuItemId, item.quantity + 1)}><Icon name="add" size="sm" /></button>
      </div>
      <span>{formatMoney(item.unitPrice * item.quantity)}</span>
    </div>)}
    <div className="cart-total"><span>جمع سفارش</span><span>{formatMoney(total)}</span></div>
  </section>
}
