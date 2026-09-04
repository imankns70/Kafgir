import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CartAddedToast, type CartAddition } from './CartAddedToast'

const addition: CartAddition = {
  key: 1,
  foodName: 'قورمه سبزی',
  imageUrl: null,
  withPersianRice: true,
  quantity: 2,
  lineTotal: 660000,
  cartCount: 3,
}

const render = (value: CartAddition | null) => renderToStaticMarkup(createElement(CartAddedToast, {
  addition: value,
  onOpenCart: vi.fn(),
  onDismiss: vi.fn(),
}))

describe('add-to-cart confirmation', () => {
  it('renders nothing until something is added', () => {
    expect(render(null)).toBe('')
  })

  it('names the food, the quantity now in the basket and its price', () => {
    const html = render(addition)

    expect(html).toContain('قورمه سبزی')
    expect(html).toContain('به سبد خرید اضافه شد')
    expect(html).toContain('با برنج ایرانی')
    expect(html).toContain('660,000')
  })

  it('offers the cart as the next step, with the number of lines in it', () => {
    expect(render(addition)).toMatch(/cart-toast-action[\s\S]*مشاهده سبد/)
  })

  it('announces itself without stealing focus', () => {
    const html = render(addition)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })
})
