import { describe, expect, it } from 'vitest'
import { adminOperations } from '../../shared/admin-operations'
import {
  firstAllowedPage,
  isPageAllowed,
  navigationGroupForPage,
  navigationGroups,
  navigationPage,
  toggleNavigationGroup,
  visibleNavigationGroups,
} from './admin-navigation'

const allPages = navigationGroups.flatMap((group) => group.items.map((item) => item.page))
const groupItems = (id: string) =>
  navigationGroups.find((group) => group.id === id)?.items.map((item) => item.page) ?? []

describe('admin navigation structure', () => {
  it('lists every destination exactly once', () => {
    expect(allPages).toHaveLength(new Set(allPages).size)
  })

  it('reaches every admin screen the app can render', () => {
    expect(allPages).toEqual(expect.arrayContaining([
      'menu', 'delivery-days', 'courier-days', 'orders', 'manual', 'customer-communication',
      'report', 'customer-report', 'customers', 'site-analytics',
      'foods',
      'purchases', 'months', 'payments', 'courier-accounting',
      'social-dashboard', 'social-channels', 'social-publish', 'social-templates',
      'social-rules', 'social-suggestions', 'social-history',
      'categories', 'tags', 'food-tag-groups', 'delivery-slots', 'couriers', 'support-subjects',
      'payment-methods', 'delivery-methods', 'logs',
    ]))
  })

  it('gates every item on a real admin operation', () => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        expect(adminOperations).toContain(item.operation)
      }
    }
  })
})

describe('reference data versus configuration', () => {
  it('groups the lookup lists other records point at under اطلاعات پایه', () => {
    expect(groupItems('reference')).toEqual([
      'categories', 'tags', 'food-tag-groups', 'delivery-slots', 'couriers', 'support-subjects',
    ])
  })

  /**
   * The three courier screens are deliberately in three different groups, because they answer three
   * different questions: who our couriers are (a lookup list), what today's arrangement is (an
   * operational decision taken per date), and what we owe (money).
   */
  it('splits the courier screens by what the operator is actually doing', () => {
    expect(navigationGroupForPage('couriers')).toBe('reference')
    expect(navigationGroupForPage('courier-days')).toBe('sales')
    expect(navigationGroupForPage('courier-accounting')).toBe('finance')
  })

  it('keeps checkout configuration out of reference data', () => {
    // Payment and delivery methods are enum-bounded and carry commercial terms, so they are settings.
    expect(groupItems('reference')).not.toContain('payment-methods')
    expect(groupItems('reference')).not.toContain('delivery-methods')
    expect(groupItems('settings')).toEqual(['payment-methods', 'delivery-methods', 'logs'])
  })

  it('separates the reusable delivery windows from the per-date capacity screen', () => {
    // The window list is master data; the day view is an operational decision taken per date.
    expect(navigationGroupForPage('delivery-slots')).toBe('reference')
    expect(navigationGroupForPage('delivery-days')).toBe('sales')
  })

  it('keeps order-scoped support with the sales flow rather than in reference data', () => {
    expect(navigationGroupForPage('customer-communication')).toBe('sales')
  })
})

describe('the simplified information architecture', () => {
  /**
   * The inventory, procurement and accounting screens are gone, not hidden. A destination left
   * behind — even an unreachable one — is how a "removed" subsystem quietly comes back.
   */
  it('has no destination left from the removed subsystems', () => {
    for (const page of [
      'ingredients', 'inventory', 'shopping', 'suppliers', 'recipes', 'finance', 'v15-reports', 'units',
    ]) {
      expect(allPages).not.toContain(page)
    }
  })

  it('has no supply group at all', () => {
    expect(navigationGroups.map((group) => group.id)).not.toContain('supply')
  })

  /** Money is now four destinations rather than a subsystem. */
  it('keeps the finance group small and about money that moved', () => {
    expect(groupItems('finance')).toEqual([
      'purchases', 'months', 'payments', 'courier-accounting',
    ])
  })

  /**
   * Website statistics used to be the largest block on the dashboard. They kept their data and their
   * service; only their location changed, to somewhere an operator goes deliberately.
   */
  it('gives website-user analytics a destination of its own, in the sales group', () => {
    expect(allPages).toContain('site-analytics')
    expect(navigationGroupForPage('site-analytics')).toBe('sales')
  })
})

describe('navigation behaviour', () => {
  it('keeps nested food screens highlighted under their parent', () => {
    expect(navigationPage('food-editor')).toBe('foods')
    expect(navigationPage('food-photos')).toBe('foods')
    expect(navigationPage('food-tags')).toBe('foods')
    expect(navigationGroupForPage('food-editor')).toBe('catalog')
  })

  it('does not assign the permanent dashboard item to a group', () => {
    expect(navigationGroupForPage('dashboard')).toBeNull()
  })

  it('closes an expanded group when its header is selected again', () => {
    expect(toggleNavigationGroup('sales', 'sales')).toBeNull()
    expect(toggleNavigationGroup(null, 'sales')).toBe('sales')
    expect(toggleNavigationGroup('catalog', 'sales')).toBe('sales')
  })

  it('gives every group an icon so the collapsed rail stays navigable', () => {
    for (const group of navigationGroups) expect(group.icon).toBeTruthy()
  })
})

describe('permission-aware navigation', () => {
  it('shows an owner everything', () => {
    const visible = visibleNavigationGroups(['Owner']).flatMap((group) => group.items)
    expect(visible).toHaveLength(allPages.length)
  })

  it('hides checkout configuration from the kitchen but keeps its own reference data', () => {
    const kitchen = visibleNavigationGroups(['KitchenAdmin'])
    const pages = kitchen.flatMap((group) => group.items.map((item) => item.page))
    expect(pages).toContain('food-tag-groups')
    expect(pages).not.toContain('payment-methods')
    expect(pages).not.toContain('delivery-methods')
  })

  it('keeps the customer report with sales and off limits to the kitchen', () => {
    // Customer PII aggregated across orders belongs to whoever owns the customer relationship.
    expect(navigationGroupForPage('customer-report')).toBe('sales')
    expect(navigationGroupForPage('customers')).toBe('sales')
    const kitchen = visibleNavigationGroups(['KitchenAdmin'])
      .flatMap((group) => group.items.map((item) => item.page))
    expect(kitchen).not.toContain('customer-report')
    expect(kitchen).not.toContain('customers')
    const orderManager = visibleNavigationGroups(['OrderManager'])
      .flatMap((group) => group.items.map((item) => item.page))
    expect(orderManager).toContain('customer-report')
    expect(orderManager).toContain('customers')
  })

  it('hides catalog reference data from an order manager', () => {
    const pages = visibleNavigationGroups(['OrderManager'])
      .flatMap((group) => group.items.map((item) => item.page))
    expect(pages).toContain('orders')
    expect(pages).toContain('payments')
    expect(pages).not.toContain('food-tag-groups')
  })

  it('drops a group entirely when no item in it is permitted', () => {
    const ids = visibleNavigationGroups(['OrderManager']).map((group) => group.id)
    expect(ids).not.toContain('social')
  })

  it('never offers a destination the roles cannot open', () => {
    for (const roles of [['KitchenAdmin'], ['OrderManager'], ['Owner']]) {
      for (const group of visibleNavigationGroups(roles)) {
        for (const item of group.items) expect(isPageAllowed(item.page, roles)).toBe(true)
      }
    }
  })

  it('reports a landing page for every role and none for an unknown one', () => {
    expect(firstAllowedPage(['Owner'])).toBe('menu')
    expect(firstAllowedPage(['KitchenAdmin'])).toBeTruthy()
    expect(firstAllowedPage(['OrderManager'])).toBeTruthy()
    expect(firstAllowedPage(['Unknown'])).toBeNull()
  })

  it('treats the dashboard as reachable by anyone signed in', () => {
    expect(isPageAllowed('dashboard', ['Unknown'])).toBe(true)
  })
})
