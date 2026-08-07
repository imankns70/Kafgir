import { describe, expect, it } from 'vitest'
import type { CartItem } from '../../types'
import { removalWouldEmptyCart } from './CartSummary'

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
