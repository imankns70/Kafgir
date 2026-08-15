import { describe, expect, it } from 'vitest'
import {
  navigationGroupForPage,
  navigationGroups,
  navigationPage,
  toggleNavigationGroup,
} from './admin-navigation'

describe('grouped admin navigation', () => {
  it('contains every public admin destination exactly once', () => {
    const pages = navigationGroups.flatMap((group) => group.items.map((item) => item.page))
    expect(pages).toHaveLength(new Set(pages).size)
    expect(pages).toEqual(expect.arrayContaining([
      'orders', 'manual', 'customer-communication', 'menu', 'report', 'foods', 'categories', 'tags', 'recipes',
      'ingredients', 'inventory', 'purchases', 'suppliers', 'shopping',
      'finance', 'payments', 'v15-reports', 'logs',
      'social-dashboard', 'social-channels', 'social-publish', 'social-templates',
      'social-rules', 'social-suggestions', 'social-history',
    ]))
  })

  it('keeps private customer communication alongside orders', () => {
    expect(navigationGroupForPage('customer-communication')).toBe('orders')
  })

  it('keeps nested food pages under the products group with foods active', () => {
    expect(navigationPage('food-editor')).toBe('foods')
    expect(navigationPage('food-photos')).toBe('foods')
    expect(navigationPage('food-tags')).toBe('foods')
    expect(navigationGroupForPage('food-editor')).toBe('products')
    expect(navigationGroupForPage('food-photos')).toBe('products')
    expect(navigationGroupForPage('food-tags')).toBe('products')
  })

  it('does not assign the permanent dashboard item to an accordion group', () => {
    expect(navigationGroupForPage('dashboard')).toBeNull()
  })

  it('closes an expanded group when its header is selected again', () => {
    expect(toggleNavigationGroup('orders', 'orders')).toBeNull()
    expect(toggleNavigationGroup(null, 'orders')).toBe('orders')
    expect(toggleNavigationGroup('products', 'orders')).toBe('orders')
  })
})
