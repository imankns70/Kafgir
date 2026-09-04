import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CartItem } from '../../types'
import { CartSummary, removalWouldEmptyCart } from './CartSummary'

const item = (id: number, quantity = 1): CartItem => ({
  dailyMenuItemId: id,
  foodName: `غذای ${id}`,
  unitPrice: 100000,
  quantity,
  remainingPortions: 5,
})

describe('empty-cart confirmation', () => {
  it('warns when decrementing the last single portion to zero', () => {
    expect(removalWouldEmptyCart([item(1)], 1, 0)).toBe(true)
  })

  it('warns when removing the only food even if it has multiple portions', () => {
    expect(removalWouldEmptyCart([item(1, 3)], 1, 0)).toBe(true)
  })

  it('does not interrupt removal while another food remains', () => {
    expect(removalWouldEmptyCart([item(1), item(2)], 1, 0)).toBe(false)
  })

  it('does not interrupt a normal quantity decrease', () => {
    expect(removalWouldEmptyCart([item(1, 2)], 1, 1)).toBe(false)
  })
})

describe('cart item presentation', () => {
  it('pairs the detail and remove actions in the corner opposite the food name', () => {
    const html = renderToStaticMarkup(createElement(CartSummary, {
      items: [{ ...item(1), slug: 'food-1' }],
      onQuantityChange: vi.fn(),
    }))

    // Name and price, then the paired item actions, then quantity and the line total beneath them.
    expect(html).toMatch(/cart-name[\s\S]*cart-unit-price[\s\S]*cart-item-buttons[\s\S]*cart-detail-button[\s\S]*cart-remove-button[\s\S]*cart-item-actions[\s\S]*quantity-controls[\s\S]*cart-line-total/)
  })

  it('keeps the item list in its own scroll area, with the total outside it', () => {
    const html = renderToStaticMarkup(createElement(CartSummary, {
      items: [item(1), item(2), item(3)],
      onQuantityChange: vi.fn(),
    }))

    expect(html).toMatch(/cart-item-count[\s\S]*cart-items[\s\S]*cart-row[\s\S]*cart-total/)
    // The total must not sit inside the scrolling list, or it scrolls away with the foods.
    expect(html.slice(html.indexOf('cart-total'))).not.toContain('cart-row')
  })
})
