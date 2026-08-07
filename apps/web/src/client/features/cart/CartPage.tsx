import type { CartItem, OrderDto } from '../../types'
import { CartSummary } from './CartSummary'
import { CheckoutForm } from '../orders/CheckoutForm'
import { Icon } from '../../design-system/Icon'

type Props = {
  items: CartItem[]
  messages: string[]
  isChecking: boolean
  isVerified: boolean
  onRefresh: () => void
  onQuantityChange: (id: number, quantity: number) => void
  onBack: () => void
  onSuccess: (order: OrderDto) => void
  onAuthenticationChange: (authenticated: boolean) => void
}

export function CartPage({ items, messages, isChecking, isVerified, onRefresh, onQuantityChange, onBack, onSuccess, onAuthenticationChange }: Props) {
  const requiresAttention = !isChecking && (!isVerified || messages.length > 0)
  return <main className="checkout-page">
    <div className="page-actions"><div><span className="eyebrow"><Icon name="confirm" size="sm" /> مرحله نهایی</span><h1 className="section-title">ثبت سفارش</h1></div><button className="checkout-back-link" onClick={onBack}>ادامه خرید <Icon name="back" size="sm" /></button></div>
    {requiresAttention && <section className="cart-sync-panel has-warning" role="alert" aria-live="polite">
      <span className="cart-sync-icon"><Icon name="info" size="md" /></span>
      <div>
        <strong>برای ادامه، سبد خرید را اصلاح کنید</strong>
        {messages.length > 0
          ? <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
          : <small>بررسی موجودی کامل نشد. دوباره تلاش کنید.</small>}
      </div>
      <button type="button" onClick={onRefresh} disabled={isChecking}><Icon name="refresh" size="sm" /> به‌روزرسانی موجودی</button>
    </section>}
    <CartSummary items={items} onQuantityChange={onQuantityChange} />
    <CheckoutForm items={items} isCartVerified={isVerified} isCheckingCart={isChecking} onRefreshCart={onRefresh} onSuccess={onSuccess} onAuthenticationChange={onAuthenticationChange} />
  </main>
}
