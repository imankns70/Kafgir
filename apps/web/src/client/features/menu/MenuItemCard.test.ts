import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DailyMenuItemDto, PersianRiceDto } from '../../types'
import { MenuItemCard } from './MenuItemCard'

const food: DailyMenuItemDto = {
  id: 12,
  foodId: 5,
  slug: 'ghormeh-sabzi',
  foodName: 'قورمه‌سبزی',
  foodDescription: 'خورشت خانگی',
  imageUrl: '/food.webp',
  category: { id: 1, title: 'غذای اصلی', slug: 'main', icon: null },
  primaryBadge: null,
  tags: [],
  allowsPersianRice: true,
  price: 260000,
  originalPrice: null,
  discountPercentage: null,
  capacityPortions: 10,
  soldPortions: 2,
  remainingPortions: 8,
  isAvailable: true,
}

const rice: PersianRiceDto = {
  menuItemId: 90,
  foodId: 21,
  title: 'برنج ایرانی',
  imageUrl: null,
  price: 30000,
  capacityPortions: 10,
  soldPortions: 0,
  remainingPortions: 10,
  isAvailable: true,
}

describe('MenuItemCard', () => {
  it('keeps the compact Persian rice choice on the fresh-cooking metadata row', () => {
    const html = renderToStaticMarkup(createElement(MenuItemCard, {
      item: food,
      persianRice: rice,
      cartItems: [],
      onAdd: vi.fn(),
      onQuantityChange: vi.fn(),
    }))

    const metadata = html.match(/<div class="menu-card-meta"[^>]*>([\s\S]*?)<\/div>/u)?.[1]
    expect(metadata).toContain('پخت تازه امروز')
    expect(metadata).toContain('class="rice-upgrade-option"')
    expect(metadata).toContain('با برنج ایرانی (+30,000 تومان)')
  })
})
