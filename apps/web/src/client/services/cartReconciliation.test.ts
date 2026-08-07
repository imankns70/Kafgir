import { describe, expect, it } from 'vitest'
import type { CartItem } from '../types'
import { cartItemIssue, reconcileCart, type CartMenuSnapshot } from './cartReconciliation'

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  dailyMenuItemId: 12,
  foodName: 'قورمه‌سبزی',
  unitPrice: 430000,
  quantity: 2,
  remainingPortions: 4,
  availability: 'available',
  availabilityMessage: null,
  ...overrides,
})

const rice = { menuItemId: 91, foodId: 9, title: 'برنج ایرانی', price: 55000,
  capacityPortions: 3, soldPortions: 1, remainingPortions: 2, isAvailable: true }

const menu = (
  overrides: Partial<NonNullable<CartMenuSnapshot>['items'][number]> = {},
  persianRice: NonNullable<CartMenuSnapshot>['persianRice'] = null,
): NonNullable<CartMenuSnapshot> => ({
  isOpen: true,
  items: [{ id: 12, foodName: 'قورمه‌سبزی', price: 430000, isAvailable: true, remainingPortions: 4,
    allowsPersianRice: false, ...overrides }],
  persianRice,
})

describe('cart reconciliation', () => {
  it('retains sold-out food and explains why checkout is blocked', () => {
    const result = reconcileCart([item()], menu({ remainingPortions: 0 }))
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.availability).toBe('sold-out')
    expect(cartItemIssue(result.items[0]!)).toContain('ظرفیت')
  })

  it('does not silently reduce a quantity when remaining capacity decreases', () => {
    const result = reconcileCart([item({ quantity: 3 })], menu({ remainingPortions: 1 }))
    expect(result.items[0]?.quantity).toBe(3)
    expect(cartItemIssue(result.items[0]!)).toContain('فقط 1 پرس')
  })

  it('retains an item that is no longer on today menu', () => {
    const result = reconcileCart([item()], { isOpen: true, items: [], persianRice: null })
    expect(result.items[0]?.availability).toBe('not-on-menu')
    expect(result.messages[0]).toContain('دیگر در منوی امروز نیست')
  })

  it('prices an upgraded line separately and caps it at the Persian rice capacity', () => {
    const result = reconcileCart(
      [item({ withPersianRice: true, persianRiceTitle: 'برنج ایرانی', persianRicePrice: 0, quantity: 2 })],
      menu({ price: 360000, originalPrice: 400000, allowsPersianRice: true }, rice),
    )
    expect(result.items[0]?.unitPrice).toBe(360000)
    expect(result.items[0]?.originalUnitPrice).toBe(400000)
    expect(result.items[0]?.persianRicePrice).toBe(55000)
    // Dish capacity is 4, but only 2 portions of Persian rice remain.
    expect(result.items[0]?.remainingPortions).toBe(2)
    expect(result.items[0]?.persianRiceTitle).toBe('برنج ایرانی')
  })

  it('leaves a plain line untouched by the Persian rice running out', () => {
    const result = reconcileCart(
      [item({ quantity: 2 })],
      menu({ allowsPersianRice: true }, { ...rice, remainingPortions: 0 }),
    )
    expect(result.items[0]?.availability).toBe('available')
    expect(result.items[0]?.remainingPortions).toBe(4)
    expect(cartItemIssue(result.items[0]!)).toBeNull()
  })

  it('shares one dish capacity across its plain and upgraded lines', () => {
    // The dish has 4 portions left. 3 plain + 3 upgraded is 6 — the second line must be flagged
    // rather than both passing and letting the server reject the order at checkout.
    const result = reconcileCart(
      [
        item({ quantity: 3 }),
        item({ quantity: 3, withPersianRice: true, persianRiceTitle: 'برنج ایرانی' }),
      ],
      menu({ allowsPersianRice: true }, { ...rice, remainingPortions: 10 }),
    )
    expect(cartItemIssue(result.items[0]!)).toBeNull()
    expect(result.items[1]?.remainingPortions).toBe(1)
    expect(cartItemIssue(result.items[1]!)).toContain('فقط 1 پرس')
  })

  it('blocks an upgraded line when the Persian rice left the menu', () => {
    const result = reconcileCart(
      [item({ withPersianRice: true, persianRiceTitle: 'برنج ایرانی', quantity: 1 })],
      menu({ allowsPersianRice: true }, null),
    )
    expect(result.items[0]?.availability).toBe('unavailable')
    expect(cartItemIssue(result.items[0]!)).not.toBeNull()
  })

  it('explains that today menu is unavailable even when the cart is empty', () => {
    const result = reconcileCart([], null)
    expect(result.items).toEqual([])
    expect(result.messages[0]).toContain('منوی امروز')
  })

  it('restores an item when it becomes orderable again and refreshes its price', () => {
    const result = reconcileCart([item({ availability: 'sold-out', remainingPortions: 0 })], menu({ price: 450000 }))
    expect(result.items[0]).toMatchObject({ availability: 'available', remainingPortions: 4, unitPrice: 450000 })
    expect(cartItemIssue(result.items[0]!)).toBeNull()
    expect(result.messages).toEqual([])
  })

  it('applies a new menu discount to an existing cart without an error banner', () => {
    const result = reconcileCart([item()], menu({
      price: 387000,
      originalPrice: 430000,
      discountPercentage: 10,
    }))
    expect(result.items[0]).toMatchObject({
      unitPrice: 387000,
      originalUnitPrice: 430000,
      discountPercentage: 10,
    })
    expect(result.messages).toEqual([])
  })
})
