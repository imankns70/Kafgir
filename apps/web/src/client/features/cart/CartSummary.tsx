import Link from 'next/link'
import type { CartItem } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { Icon } from '../../design-system/Icon'
import { PriceDisplay } from '../../design-system/PriceDisplay'
import { cartItemIssue } from '../../services/cartReconciliation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function removalWouldEmptyCart(items: CartItem[], itemId: number, nextQuantity: number) {
  return nextQuantity <= 0
    && items.length === 1
    && items[0]?.dailyMenuItemId === itemId
}

/** A small square photo for a basket line, falling back to a quiet brand mark rather than the menu's large placeholder. */
function CartThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className="cart-thumb-placeholder" aria-hidden="true"><Icon name="food" size="lg" /></span>
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

export function CartSummary({ items, onQuantityChange, deliveryCost, stepCaption }: {
  items: CartItem[]
  onQuantityChange: (id: number, quantity: number, withPersianRice?: boolean) => void
  /** Resolved by checkout. Shown on phones, where the payment screen with the same figures is three
   *  steps away; on desktop the form's own totals are already beside the basket. */
  deliveryCost?: { fee: number | null; isLoading: boolean }
  /** The checkout wizard's «مرحله ۱ از ۴», shown above the title on phones. */
  stepCaption?: ReactNode
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
    {stepCaption}
    <h2 className="section-title">سبد خرید{items.length > 0 && <span className="cart-item-count">{formatNumber(items.length)} قلم</span>}</h2>
    {items.length === 0 && <p className="muted">سبد خرید شما خالی است.</p>}
    {/* A long basket used to push the total and the whole checkout form below the fold. The list
        keeps its own bounded scroll area so «جمع اقلام» and the start of the form stay on screen
        however many foods were added; short baskets never reach the limit and never scroll. */}
    <div className="cart-items">
    {items.map((item) => {
      const issue = cartItemIssue(item)
      const canAdjust = (item.availability ?? 'available') === 'available' && item.remainingPortions > 0
      const detailHref = item.slug ? `/foods/${encodeURIComponent(item.slug)}?menuItemId=${item.dailyMenuItemId}` : null
      // The photo and the name both open the food's page; a separate «جزئیات» button only repeated
      // what tapping the food already does.
      const thumb = <CartThumb src={item.imageUrl} alt={item.foodName} />
      return <div className={`cart-row ${issue ? 'cart-row-invalid' : ''}`} key={`${item.dailyMenuItemId}:${Boolean(item.withPersianRice)}`}>
        {detailHref
          ? <Link className="cart-thumb" href={detailHref} aria-label={`مشاهده جزئیات ${item.foodName}`} tabIndex={-1}>{thumb}</Link>
          : <span className="cart-thumb">{thumb}</span>}
        <div className="cart-item-main">
          <div className="cart-item-head">
            {detailHref
              ? <Link className="cart-name" href={detailHref}>{item.foodName}</Link>
              : <span className="cart-name">{item.foodName}</span>}
            <button type="button" className="cart-remove-button" aria-label={`حذف ${item.foodName} از سبد`} onClick={() => requestQuantityChange(item, 0)}><Icon name="delete" size="sm" /></button>
          </div>
          <div className="cart-unit-price"><PriceDisplay compact label="" price={item.unitPrice} originalPrice={item.originalUnitPrice} discountPercentage={item.discountPercentage} /></div>
          {item.persianRiceTitle && <div className="cart-rice-option">
            <Icon name="confirm" size="xs" aria-hidden="true" />
            <span>{item.persianRiceTitle}</span>
            <small>+{formatMoney(item.persianRicePrice ?? 0)}</small>
          </div>}
          {issue && <span className="cart-item-warning"><Icon name="info" size="xs" />{issue}</span>}
          <div className="cart-item-actions">
            {canAdjust && <div className="quantity-controls">
              <button type="button" className="quantity-button" aria-label={`کم کردن تعداد ${item.foodName}`} onClick={() => requestQuantityChange(item, item.quantity - 1)}><Icon name="minus" size="sm" /></button>
              <strong>{formatNumber(item.quantity)}</strong>
              <button type="button" className="quantity-button" aria-label={`اضافه کردن تعداد ${item.foodName}`} disabled={item.quantity >= item.remainingPortions}
                onClick={() => onQuantityChange(item.dailyMenuItemId, item.quantity + 1, Boolean(item.withPersianRice))}><Icon name="add" size="sm" /></button>
            </div>}
            <span className="cart-line-total">{formatMoney(lineTotal(item))}{issue && <small>در جمع قابل سفارش محاسبه نشده</small>}</span>
          </div>
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
    {/* On phones the food total joins the courier charge and final amount as one plain list, instead
        of a highlighted box above two lighter rows. */}
    <div className={`cart-total${deliveryCost && items.length > 0 ? ' checkout-desktop-only' : ''}`}><span>جمع اقلام قابل سفارش</span><span>{formatMoney(total)}</span></div>
    {deliveryCost && items.length > 0 && <div className="cart-delivery-cost checkout-mobile-only">
      <div><span>جمع غذاها</span><strong>{formatMoney(total)}</strong></div>
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
