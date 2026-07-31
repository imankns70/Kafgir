import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber, formatPersianDateTime } from './format'

const persianDigitPattern = /[۰-۹]/

describe('web number formatting', () => {
  it('uses Latin digits and keeps grouped prices', () => {
    expect(formatNumber(12)).toBe('12')
    expect(formatMoney(550000)).toBe('550,000 تومان')
  })

  it('uses Latin digits in Persian calendar dates', () => {
    const value = formatPersianDateTime('2026-07-31T12:00:00.000Z')
    expect(value).not.toMatch(persianDigitPattern)
    expect(value).toContain('1405')
  })
})
