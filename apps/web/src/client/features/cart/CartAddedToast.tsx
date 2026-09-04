import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../design-system/Icon'
import { FoodImage } from '../../design-system/FoodImage'
import { formatMoney, formatNumber } from '../../utils/format'

export type CartAddition = {
  /** Changes on every add, so adding the same food twice replays the toast. */
  key: number
  foodName: string
  imageUrl: string | null
  withPersianRice: boolean
  /** How many of this line are now in the basket, not how many were just added. */
  quantity: number
  lineTotal: number
  cartCount: number
}

const visibleFor = 4_500

/**
 * The confirmation that an item reached the basket. A silent add leaves the customer scrolling back
 * to the cart button to check, so the toast states what was added, how many are now in the basket,
 * and offers the one action that follows — opening the cart. It dismisses itself, can be swiped
 * away, and never blocks the page underneath.
 */
export function CartAddedToast({ addition, onOpenCart, onDismiss }: {
  addition: CartAddition | null
  onOpenCart: () => void
  onDismiss: () => void
}) {
  const [dragOffset, setDragOffset] = useState(0)
  const dragStart = useRef<number | null>(null)

  useEffect(() => {
    if (!addition) return
    setDragOffset(0)
    dragStart.current = null
    const timer = window.setTimeout(onDismiss, visibleFor)
    return () => window.clearTimeout(timer)
  }, [addition, onDismiss])

  if (!addition) return null

  // Downward swipe dismisses; upward movement is ignored so the card cannot be dragged off the top.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) return
    setDragOffset(Math.max(0, event.clientY - dragStart.current))
  }
  const onPointerUp = () => {
    if (dragStart.current == null) return
    dragStart.current = null
    if (dragOffset > 60) onDismiss()
    else setDragOffset(0)
  }

  return <div className="cart-toast" role="status" aria-live="polite"
    style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
    <span className="cart-toast-grip" aria-hidden="true" />
    <div className="cart-toast-body">
      <span className="cart-toast-thumb"><FoodImage src={addition.imageUrl} alt="" /></span>
      <div className="cart-toast-copy">
        <strong><Icon name="confirm" size="xs" /> به سبد خرید اضافه شد</strong>
        <span className="cart-toast-name">{addition.foodName}</span>
        <small>
          {formatNumber(addition.quantity)} پرس{addition.withPersianRice ? ' با برنج ایرانی' : ''} — {formatMoney(addition.lineTotal)}
        </small>
      </div>
      <button type="button" className="cart-toast-close" aria-label="بستن" onClick={onDismiss}>
        <Icon name="cancel" size="sm" />
      </button>
    </div>
    <button type="button" className="primary-button cart-toast-action" onClick={onOpenCart}>
      <Icon name="cart" size="sm" /> مشاهده سبد ({formatNumber(addition.cartCount)})
    </button>
  </div>
}
