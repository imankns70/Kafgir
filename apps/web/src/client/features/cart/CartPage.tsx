import { useEffect, useState } from 'react'
import type { CartItem, OrderDto } from '../../types'
import { CartSummary } from './CartSummary'
import { CheckoutForm } from '../orders/CheckoutForm'
import { CheckoutStepCaption } from '../orders/CheckoutStepCaption'
import { ButtonLoading } from '../../design-system/ButtonLoading'
import { Icon } from '../../design-system/Icon'

/**
 * Checkout is one page on desktop and a three-step wizard on phones, where the full page meant
 * scrolling past every food to reach the fields and then back up to fix something. Which parts are
 * on screen is decided in CSS from `data-wizard-step`, so the desktop layout keeps every block and
 * nothing depends on the browser reporting a width to React. The step only ever changes on phones,
 * because the controls that change it are hidden on wider screens.
 */
export type CheckoutStep = 'cart' | 'delivery' | 'time' | 'payment'

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
  const [step, setStep] = useState<CheckoutStep>('cart')
  // The courier charge is fetched and interpreted by the checkout form; the cart step only displays
  // what the form resolved, so a phone customer sees the real cost before leaving the basket.
  const [deliveryCost, setDeliveryCost] = useState<{ fee: number | null; isLoading: boolean }>({ fee: null, isLoading: true })
  const requiresAttention = !isChecking && (!isVerified || messages.length > 0)

  // A new step starts at its own beginning: without this the customer lands halfway down the next
  // step, at the scroll position the previous one ended on.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 639px)').matches) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // An emptied basket has nothing to arrange delivery or payment for.
  useEffect(() => {
    if (items.length === 0) setStep('cart')
  }, [items.length])


  return <main className="checkout-page" data-wizard-step={step}>
    {/* On a phone the step's card is the whole page: the page title, the shopping link and a step
        trail only pushed the form down, so they are desktop-only and «ادامه خرید» lives in the
        cart step's bottom bar instead. */}
    <div className="page-actions checkout-desktop-only"><div><span className="eyebrow"><Icon name="confirm" size="sm" /> مرحله نهایی</span><h1 className="section-title">ثبت سفارش</h1></div><button className="checkout-back-link" onClick={onBack}>ادامه خرید <Icon name="back" size="sm" /></button></div>
    <div className="checkout-step-block" data-step="cart">
      {requiresAttention && <section className="cart-sync-panel has-warning" role="alert" aria-live="polite">
        <span className="cart-sync-icon"><Icon name="info" size="md" /></span>
        <div>
          <strong>برای ادامه، سبد خرید را اصلاح کنید</strong>
          {messages.length > 0
            ? <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
            : <small>بررسی موجودی کامل نشد. دوباره تلاش کنید.</small>}
        </div>
        <button type="button" onClick={onRefresh} disabled={isChecking}>{isChecking ? <ButtonLoading label="در حال بررسی موجودی…" /> : <><Icon name="refresh" size="sm" /> به‌روزرسانی موجودی</>}</button>
      </section>}
      <CartSummary items={items} onQuantityChange={onQuantityChange} deliveryCost={deliveryCost}
        stepCaption={<CheckoutStepCaption index={0} />} />
      <div className="checkout-wizard-actions">
        <button type="button" className="outline-button checkout-secondary-action" onClick={onBack}>ادامه خرید</button>
        <button type="button" className="primary-button" disabled={items.length === 0} onClick={() => setStep('delivery')}>
          ادامه به اطلاعات تحویل <Icon name="back" size="sm" />
        </button>
      </div>
    </div>
    <CheckoutForm items={items} isCartVerified={isVerified} isCheckingCart={isChecking} onRefreshCart={onRefresh} onSuccess={onSuccess}
      onAuthenticationChange={onAuthenticationChange} wizardStep={step} onWizardStepChange={setStep} onDeliveryCostChange={setDeliveryCost} />
  </main>
}
