import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatNumber,
  formatPersianDate,
  formatPersianDateTime,
  parseMoney,
  persianDateWithLatinDigitsLocale,
} from './number-format'

const persianDigitPattern = /[۰-۹]/

describe('admin number formatting', () => {
  it('uses Latin digits and keeps grouped prices', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatMoney(450000)).toBe('450,000 تومان')
  })

  it('shows a bare ISO date in the Persian calendar', () => {
    // The purchases and shopping-list tables used to print this string raw.
    expect(formatPersianDate('2026-08-17')).toContain('1405')
    expect(formatPersianDate('2026-08-17')).not.toContain('2026')
  })

  it('does not shift a bare date backwards across the Tehran offset', () => {
    // Parsed as UTC midnight this is still 2026-08-16 in Tehran, which would print the wrong day.
    expect(formatPersianDate('2026-08-17')).toBe(formatPersianDate('2026-08-17T12:00:00+03:30'))
  })

  it('formats timestamps with a clock time, still in the Persian calendar', () => {
    const value = formatPersianDateTime('2026-08-17T10:00:00.000Z')
    expect(value).toContain('1405')
    expect(value).toMatch(/\d{1,2}:\d{2}/u)
  })

  it('renders an em dash instead of "Invalid Date" for missing or broken values', () => {
    expect(formatPersianDate(null)).toBe('—')
    expect(formatPersianDate('')).toBe('—')
    expect(formatPersianDate('not-a-date')).toBe('—')
    expect(formatPersianDateTime(undefined)).toBe('—')
    expect(formatPersianDateTime('not-a-date')).toBe('—')
  })

  it('keeps Latin digits in dates so they sit beside prices and order numbers', () => {
    expect(formatPersianDate('2026-08-17')).not.toMatch(persianDigitPattern)
    expect(formatPersianDateTime('2026-08-17T10:00:00.000Z')).not.toMatch(persianDigitPattern)
  })

  it('keeps Persian calendar dates but uses Latin digits', () => {
    const value = new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran',
    }).format(new Date('2026-07-31T12:00:00.000Z'))
    expect(value).not.toMatch(persianDigitPattern)
    expect(value).toContain('1405')
  })
})

/**
 * The money rules themselves are tested in `@kafgir/contracts`. This only pins down that Admin
 * really is consuming those, rather than having quietly grown its own copy again.
 */
describe('admin money helpers come from the shared contract', () => {
  it('prints and reads back the same amounts the rest of Kafgir does', () => {
    expect(formatMoney(1_260_000)).toBe('1,260,000 تومان')
    expect(parseMoney('1,260,000')).toBe(1_260_000)
    expect(parseMoney('۷۰,۰۰۰')).toBe(70_000)
  })

  it('does not group figures that are not money', () => {
    // A quantity may be fractional and an order number must keep its exact digits.
    expect(formatNumber(1.5, 6)).toBe('1.5')
  })
})
