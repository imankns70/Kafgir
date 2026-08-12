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
  it('keeps the Persian rice choice in its own purchase row with a separate upgrade price', () => {
    const html = renderToStaticMarkup(createElement(MenuItemCard, {
      item: food,
      persianRice: rice,
      cartItems: [],
      onAdd: vi.fn(),
      onQuantityChange: vi.fn(),
    }))

    const metadata = html.match(/<div class="menu-card-meta"[^>]*>([\s\S]*?)<\/div>/u)?.[1]
    const purchase = html.match(/<div class="menu-card-purchase"[^>]*>([\s\S]*)<\/div><\/div><\/article>/u)?.[1]
    expect(metadata).toContain('پخت تازه امروز')
    expect(metadata).not.toContain('rice-upgrade-option')
    expect(purchase).toContain('rice-upgrade-option rice-upgrade-option-card')
    expect(purchase).toContain('class="rice-upgrade-label">با برنج ایرانی')
    expect(purchase).toContain('class="rice-upgrade-price">+30,000 تومان')
    expect(purchase).toContain('class="menu-card-action"')
    expect(purchase).toContain('260,000 تومان')
  })
})
