import { describe, expect, it } from 'vitest'
import { formatOrderNumber, orderNumberPattern, randomOrderSuffix } from './order-number'

describe('order number format', () => {
  it('is the year, a dash and six digits', () => {
    expect(formatOrderNumber('1405', 482917)).toBe('1405-482917')
    expect(orderNumberPattern.test('1405-482917')).toBe(true)
  })

  it('never matches an old counter-style number', () => {
    expect(orderNumberPattern.test('14051')).toBe(false)
    expect(orderNumberPattern.test('1405400000010')).toBe(false)
  })

  it('draws six-digit suffixes that never start with zero', () => {
    for (let index = 0; index < 1_000; index += 1) {
      const suffix = randomOrderSuffix()
      expect(suffix).toBeGreaterThanOrEqual(100_000)
      expect(suffix).toBeLessThan(1_000_000)
    }
  })
})
