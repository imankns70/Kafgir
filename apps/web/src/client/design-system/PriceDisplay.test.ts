import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PriceDisplay } from './PriceDisplay'

describe('PriceDisplay', () => {
  it('shows the original price, discount percentage, and final price', () => {
    const html = renderToStaticMarkup(createElement(PriceDisplay, {
      price: 387000,
      originalPrice: 430000,
      discountPercentage: 10,
    }))

    expect(html).toContain('<del>430,000 تومان</del>')
    expect(html).toContain('10٪')
    expect(html).toContain('387,000 تومان')
    expect(html).toContain('has-discount')
  })

  it('keeps a regular price visually simple', () => {
    const html = renderToStaticMarkup(createElement(PriceDisplay, { price: 430000 }))
    expect(html).not.toContain('<del>')
    expect(html).not.toContain('discount-pill')
    expect(html).toContain('430,000 تومان')
  })

  it('can omit the repeated discount pill when a card already has a discount badge', () => {
    const html = renderToStaticMarkup(createElement(PriceDisplay, {
      price: 387000,
      originalPrice: 430000,
      discountPercentage: 10,
      showDiscountPill: false,
    }))

    expect(html).toContain('<del>430,000 تومان</del>')
    expect(html).not.toContain('discount-pill')
  })
})
