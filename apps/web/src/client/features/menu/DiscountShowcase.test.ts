import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DailyMenuItemDto } from '../../types'
import { DiscountShowcase } from './DiscountShowcase'

const discountedFood: DailyMenuItemDto = {
  id: 12,
  foodId: 5,
  slug: 'discounted-food',
  foodName: 'غذای تخفیف‌دار',
  foodDescription: 'توضیح غذا',
  imageUrl: '/food.webp',
  category: { id: 1, title: 'غذای اصلی', slug: 'main', icon: null },
  primaryBadge: null,
  tags: [],
  allowsPersianRice: false,
  price: 360000,
  originalPrice: 400000,
  discountPercentage: 10,
  capacityPortions: 10,
  soldPortions: 2,
  remainingPortions: 8,
  isAvailable: true,
}

describe('DiscountShowcase', () => {
  it('renders nothing when today has no discounted food', () => {
    const html = renderToStaticMarkup(createElement(DiscountShowcase, {
      items: [], persianRice: null, cartItems: [], onAdd: vi.fn(), onQuantityChange: vi.fn(),
    }))
    expect(html).toBe('')
  })

  it('renders a compact discounted food action without changing the regular card', () => {
    const html = renderToStaticMarkup(createElement(DiscountShowcase, {
      items: [discountedFood], persianRice: null, cartItems: [], onAdd: vi.fn(), onQuantityChange: vi.fn(),
    }))
    expect(html).toContain('تخفیف‌های امروز')
    expect(html).toContain('غذای تخفیف‌دار')
    expect(html).toContain('400,000 تومان')
    expect(html).toContain('360,000 تومان')
    expect(html).toContain('افزودن')
  })

  it('offers the Persian rice upgrade on a discounted card and keeps each variant a separate line', () => {
    const rice = { menuItemId: 90, foodId: 21, title: 'برنج ایرانی', imageUrl: null, price: 150000,
      capacityPortions: 10, soldPortions: 0, remainingPortions: 10, isAvailable: true }
    const html = renderToStaticMarkup(createElement(DiscountShowcase, {
      items: [{ ...discountedFood, allowsPersianRice: true }],
      persianRice: rice,
      cartItems: [
        { dailyMenuItemId: 12, foodName: discountedFood.foodName, unitPrice: 360000, quantity: 1, remainingPortions: 8, withPersianRice: false },
        { dailyMenuItemId: 12, foodName: discountedFood.foodName, unitPrice: 360000, quantity: 2, remainingPortions: 8, withPersianRice: true, persianRicePrice: 150000 },
      ],
      onAdd: vi.fn(),
      onQuantityChange: vi.fn(),
    }))
    expect(html).toContain('با برنج ایرانی (+150,000 تومان)')
    // The plain line's own count, not the two variants merged into one number.
    expect(html).toContain('>1<')
    expect(html).toContain('2 پرس با برنج ایرانی هم در سبد شماست')
  })
})
