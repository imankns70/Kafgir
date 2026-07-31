import { describe, expect, it } from 'vitest'
import { evaluateFoodAvailability } from './food-discovery-service'

const available = {
  isActive: true,
  menuItemId: 10,
  isMenuOpen: true,
  isAvailable: true,
  capacityPortions: 8,
  soldPortions: 2,
  orderDeadline: null,
}

describe('food availability', () => {
  it('returns server-calculated remaining capacity', () => {
    expect(evaluateFoodAvailability(available)).toMatchObject({
      isOrderable: true,
      remaining: 6,
    })
  })

  it('marks sold-out food as not orderable', () => {
    expect(evaluateFoodAvailability({ ...available, soldPortions: 8 })).toMatchObject({
      isOrderable: false,
      remaining: 0,
    })
  })

  it('rejects a passed order deadline', () => {
    expect(evaluateFoodAvailability({
      ...available,
      orderDeadline: new Date(Date.now() - 1_000),
    }).isOrderable).toBe(false)
  })
})

