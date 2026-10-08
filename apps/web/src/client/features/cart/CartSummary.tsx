import Link from 'next/link'
import type { CartItem } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { PriceDisplay } from '../../design-system/PriceDisplay'
import { cartItemIssue } from '../../services/cartReconciliation'
import { useEffect, useRef, useState } from 'react'

export function removalWouldEmptyCart(items: CartItem[], itemId: number, nextQuantity: number) {
  return nextQuantity <= 0
    && items.length === 1
    && items[0]?.dailyMenuItemId === itemId
}

export function CartSummary({ items, onQuantityChange, deliveryCost }: {
  items: CartItem[]
  onQuantityChange: (id: number, quantity: number, withPersianRice?: boolean) => void
  /** Resolved by checkout. Shown on phones, where the payment screen with the same figures is three
   *  steps away; on desktop the form's own totals are already beside the basket. */
  deliveryCost?: { fee: number | null; isLoading: boolean }
}) {
  const [pendingEmptyItem, setPendingEmptyItem] = useState<CartItem | null>(null)
  const keepButton = useRef<HTMLButtonElement | null>(null)
  // The chosen rice becomes its own order line, so it is priced alongside the dish it belongs to.
  const lineTotal = (item: CartItem) => (item.unitPrice + (item.persianRicePrice ?? 0)) * item.quantity
  const total = items.reduce((sum, item) => cartItemIssue(item) ? sum : sum + lineTotal(item), 0)

  useEffect(() => {
    if (!pendingEmptyItem) return
    keepButton.current?.focus()
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingEmptyItem(null)
    }
    window.addEventListener('keydown', cancelWithEscape)
    return () => window.removeEventListener('keydown', cancelWithEscape)
  }, [pendingEmptyItem])

  const requestQuantityChange = (item: CartItem, nextQuantity: number) => {
    if (removalWouldEmptyCart(items, item.dailyMenuItemId, nextQuantity)) {
      setPendingEmptyItem(item)
      return
    }
    onQuantityChange(item.dailyMenuItemId, nextQuantity, Boolean(item.withPersianRice))
  }

  const confirmEmptyCart = () => {
    if (!pendingEmptyItem) return
    onQuantityChange(pendingEmptyItem.dailyMenuItemId, 0, Boolean(pendingEmptyItem.withPersianRice))
    setPendingEmptyItem(null)
  }

  return <section className="panel">
    <h2 className="section-title">سبد خرید{items.length > 0 && <span className="cart-item-count">{formatNumber(items.length)} قلم</span>}</h2>
    {items.length === 0 && <p className="muted">سبد خرید شما خالی است.</p>}
    {/* A long basket used to push the total and the whole checkout form below the fold. The list
        keeps its own bounded scroll area so «جمع اقلام» and the start of the form stay on screen
        however many foods were added; short baskets never reach the limit and never scroll. */}
    <div className="cart-items">
    {items.map((item) => {
      const issue = cartItemIssue(item)
      const canAdjust = (item.availability ?? 'available') === 'available' && item.remainingPortions > 0
      return <div className={`cart-row ${issue ? 'cart-row-invalid' : ''}`} key={`${item.dailyMenuItemId}:${Boolean(item.withPersianRice)}`}>
        <div className="cart-item-info">
          <div className="cart-name">{item.foodName}</div>
          <div className="cart-unit-price"><PriceDisplay compact label="" price={item.unitPrice} originalPrice={item.originalUnitPrice} discountPercentage={item.discountPercentage} /><small className="muted">× {formatNumber(item.quantity)}</small></div>
          {item.persianRiceTitle && <div className="cart-rice-option">
            <Icon name="confirm" size="xs" aria-hidden="true" />
            <span>{item.persianRiceTitle}</span>
            <small>{formatMoney(item.persianRicePrice ?? 0)} × {formatNumber(item.quantity)}</small>
          </div>}
          {issue && <span className="cart-item-warning"><Icon name="info" size="xs" />{issue}</span>}
        </div>
        {/* The item's own actions sit in the top corner opposite the name, where they read as
            belonging to this food and stay clear of the quantity controls below. */}
        <div className="cart-item-buttons">
          {item.slug && <Link className="outline-button cart-detail-button" href={`/foods/${encodeURIComponent(item.slug)}?menuItemId=${item.dailyMenuItemId}`} aria-label={`مشاهده جزئیات ${item.foodName}`}>
            <Icon name="info" size="sm" /><span>جزئیات</span>
          </Link>}
          <button type="button" className="primary-button cart-remove-button" aria-label={`حذف ${item.foodName} از سبد`} onClick={() => requestQuantityChange(item, 0)}><Icon name="delete" size="sm" /><span>حذف</span></button>
        </div>
        <div className="cart-item-actions">
          {canAdjust && <div className="quantity-controls">
            <button type="button" className="quantity-button" aria-label={`کم کردن تعداد ${item.foodName}`} onClick={() => requestQuantityChange(item, item.quantity - 1)}><Icon name="minus" size="sm" /></button>
            <strong>{formatNumber(item.quantity)}</strong>
            <button type="button" className="quantity-button" aria-label={`اضافه کردن تعداد ${item.foodName}`} disabled={item.quantity >= item.remainingPortions}
              onClick={() => onQuantityChange(item.dailyMenuItemId, item.quantity + 1, Boolean(item.withPersianRice))}><Icon name="add" size="sm" /></button>
          </div>}
          <span className="cart-line-total">{formatMoney(lineTotal(item))}{issue && <small>در جمع قابل سفارش محاسبه نشده</small>}</span>
        </div>
        {pendingEmptyItem?.dailyMenuItemId === item.dailyMenuItemId && pendingEmptyItem?.withPersianRice === item.withPersianRice && <div className="cart-empty-confirmation" role="alertdialog" aria-labelledby="empty-cart-title" aria-describedby="empty-cart-description">
          <div className="cart-empty-confirmation-head">
            <span className="cart-empty-confirmation-icon" aria-hidden="true"><Icon name="info" size="md" /></span>
            <strong id="empty-cart-title">سبدت خالی می‌شود</strong>
          </div>
          <p id="empty-cart-description">با حذف «{item.foodName}» دیگر چیزی در سبد نمی‌ماند. مطمئنی؟</p>
          <div className="cart-empty-confirmation-actions">
            <button ref={keepButton} type="button" className="outline-button" onClick={() => setPendingEmptyItem(null)}>نه، نگهش دار</button>
            <button type="button" className="outline-button danger-outline" onClick={confirmEmptyCart}>بله، سبد را خالی کن</button>
          </div>
        </div>}
      </div>
    })}
    </div>
    <div className="cart-total"><span>جمع اقلام قابل سفارش</span><span>{formatMoney(total)}</span></div>
    {deliveryCost && items.length > 0 && <div className="cart-delivery-cost checkout-mobile-only">
      <div><span>هزینه پیک</span><strong>{deliveryCost.isLoading
        ? 'در حال محاسبه…'
        : deliveryCost.fee === null ? 'هنوز مشخص نشده' : formatMoney(deliveryCost.fee)}</strong></div>
      <div className="cart-delivery-cost-final">
        <span>مبلغ نهایی</span>
        <strong>{deliveryCost.isLoading || deliveryCost.fee === null ? '—' : formatMoney(total + deliveryCost.fee)}</strong>
      </div>
    </div>}
  </section>
}
