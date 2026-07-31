import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber, persianDateWithLatinDigitsLocale } from './number-format'

const persianDigitPattern = /[۰-۹]/

describe('admin number formatting', () => {
  it('uses Latin digits and keeps grouped prices', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatMoney(450000)).toBe('450,000 تومان')
  })

  it('keeps Persian calendar dates but uses Latin digits', () => {
    const value = new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran',
    }).format(new Date('2026-07-31T12:00:00.000Z'))
    expect(value).not.toMatch(persianDigitPattern)
    expect(value).toContain('1405')
  })
})
