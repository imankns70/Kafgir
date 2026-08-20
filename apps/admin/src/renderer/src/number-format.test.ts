import { describe, expect, it } from 'vitest'
import {
  formatAmountInput,
  formatMoney,
  formatNumber,
  formatPersianDate,
  formatPersianDateTime,
  normalizeAmountText,
  parseAmount,
  parseTomanAmount,
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

describe('money entry', () => {
  it('reads a grouped amount back as the plain number', () => {
    expect(parseAmount('70,000')).toBe(70_000)
    expect(parseAmount('1,260,000')).toBe(1_260_000)
    expect(parseAmount('560000')).toBe(560_000)
  })

  it('accepts the digits an operator’s keyboard actually produces', () => {
    expect(parseAmount('۷۰۰۰۰')).toBe(70_000)
    expect(parseAmount('۷۰٬۰۰۰')).toBe(70_000)
    expect(parseAmount('۱،۲۶۰،۰۰۰')).toBe(1_260_000)
    expect(parseAmount('٧٠٠٠٠')).toBe(70_000)
    expect(normalizeAmountText(' ۷۰,۰۰۰ ')).toBe('70000')
  })

  it('treats an empty box as unset rather than zero', () => {
    // Clearing a fee must not silently mean free delivery.
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
  })

  it('rejects anything that is not a non-negative amount', () => {
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('70.000.000')).toBeNull()
  })

  it('rejects fractions where the amount is whole Toman', () => {
    expect(parseTomanAmount('70,000')).toBe(70_000)
    expect(parseTomanAmount('70000.5')).toBeNull()
    expect(parseAmount('70000.5')).toBe(70_000.5)
  })

  it('groups a box as it is typed, in the same style prices are printed', () => {
    expect(formatAmountInput('70000')).toBe('70,000')
    expect(formatAmountInput('1260000')).toBe('1,260,000')
    expect(formatAmountInput(560_000)).toBe('560,000')
    expect(formatAmountInput('۷۰۰۰۰')).toBe('70,000')
    expect(formatAmountInput('70,000')).toBe('70,000')
  })

  it('leaves an empty box empty and does not fight a half-typed decimal', () => {
    expect(formatAmountInput('')).toBe('')
    expect(formatAmountInput('70000.')).toBe('70,000.')
    expect(formatAmountInput('70000.5')).toBe('70,000.5')
  })

  it('round-trips: what a box shows parses back to what it holds', () => {
    for (const amount of [0, 5, 70_000, 560_000, 1_260_000]) {
      expect(parseAmount(formatAmountInput(amount))).toBe(amount)
    }
  })
})

/**
 * The controlled-input loop the money boxes run: the operator types, the box re-renders formatted,
 * and the submitted value is parsed from the held text. Admin has no DOM test harness, so this
 * exercises the same pipeline directly.
 */
describe('typing into a money box', () => {
  const type = (keys: string) => {
    let held = ''
    for (const key of keys) {
      // What a change event delivers: whatever the box was showing, plus the new character.
      held = formatAmountInput(held) + key
    }
    return { shows: formatAmountInput(held), submits: parseTomanAmount(held) }
  }

  it('groups while typing and submits the plain integer', () => {
    expect(type('70000')).toEqual({ shows: '70,000', submits: 70_000 })
    expect(type('1260000')).toEqual({ shows: '1,260,000', submits: 1_260_000 })
  })

  it('behaves the same when the keyboard produces Persian digits', () => {
    expect(type('۵۶۰۰۰۰')).toEqual({ shows: '560,000', submits: 560_000 })
  })

  it('submits nothing while the box is empty', () => {
    expect(type('')).toEqual({ shows: '', submits: null })
  })
})
