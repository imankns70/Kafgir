import { describe, expect, it } from 'vitest'
import {
  averageOrderValue,
  averageOrdersPerCustomer,
  returningShare,
} from './customer-report-rules'

describe('averageOrderValue', () => {
  it('divides revenue across orders and rounds to whole Toman', () => {
    expect(averageOrderValue(300_000, 4)).toBe(75_000)
    expect(averageOrderValue(100_000, 3)).toBe(33_333)
  })

  it('returns zero rather than NaN for a range with no orders', () => {
    expect(averageOrderValue(0, 0)).toBe(0)
    expect(averageOrderValue(500_000, 0)).toBe(0)
  })

  it('handles a range with orders but no delivered revenue', () => {
    // Every order still pending or cancelled: the average is zero, not a division artefact.
    expect(averageOrderValue(0, 12)).toBe(0)
  })

  it('never returns a negative count as a divisor', () => {
    expect(averageOrderValue(1_000, -3)).toBe(0)
  })
})

describe('averageOrdersPerCustomer', () => {
  it('reports one decimal place', () => {
    expect(averageOrdersPerCustomer(7, 5)).toBe(1.4)
    expect(averageOrdersPerCustomer(10, 4)).toBe(2.5)
  })

  it('returns zero when nobody was active', () => {
    expect(averageOrdersPerCustomer(0, 0)).toBe(0)
    expect(averageOrdersPerCustomer(9, 0)).toBe(0)
  })

  it('rounds rather than truncating', () => {
    expect(averageOrdersPerCustomer(5, 3)).toBe(1.7)
  })
})

describe('returningShare', () => {
  it('reports a percentage with one decimal', () => {
    expect(returningShare(3, 4)).toBe(75)
    expect(returningShare(1, 3)).toBe(33.3)
  })

  it('returns zero when there were no active customers', () => {
    expect(returningShare(0, 0)).toBe(0)
  })

  it('reports a fully returning cohort as one hundred', () => {
    expect(returningShare(8, 8)).toBe(100)
  })
})
