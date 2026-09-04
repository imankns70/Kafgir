import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CartItem } from '../../types'
import { CartPage } from './CartPage'

const item: CartItem = {
  dailyMenuItemId: 1,
  foodName: 'غذای آزمایشی',
  unitPrice: 100000,
  quantity: 1,
  remainingPortions: 5,
}

const render = () => renderToStaticMarkup(createElement(CartPage, {
  items: [item],
  messages: [],
  isChecking: false,
  isVerified: true,
  onRefresh: vi.fn(),
  onQuantityChange: vi.fn(),
  onBack: vi.fn(),
  onSuccess: vi.fn(),
  onAuthenticationChange: vi.fn(),
}))

describe('checkout wizard', () => {
  it('starts on the cart step', () => {
    expect(render()).toContain('data-wizard-step="cart"')
  })

  it('marks the blocks each step shows, so CSS alone can decide what is on screen', () => {
    const html = render()

    for (const step of ['cart', 'delivery', 'payment']) {
      expect(html).toContain(`data-step="${step}"`)
    }
  })

  it('renders every step of the form, so nothing is lost when the customer moves between them', () => {
    const html = render()

    // Delivery and payment fields are present on the cart step; only CSS hides them.
    expect(html).toContain('نام و نام خانوادگی')
    expect(html).toContain('روش پرداخت')
    expect(html).toContain('خلاصه مبلغ سفارش')
  })
})
