import { describe, expect, it } from 'vitest'
import {
  currentJalaliMonth,
  jalaliMonthRange,
  jalaliToday,
  previousJalaliMonth,
  purchaseToSalesPercent,
  recentJalaliMonths,
} from './jalali-month'

describe('Jalali month ranges', () => {
  it('covers مرداد ۱۴۰۵ from its first Gregorian day to its last', () => {
    const range = jalaliMonthRange(1405, 5)
    expect(range.title).toBe('مرداد 1405')
    expect(range.fromDate).toBe('2026-07-23')
    expect(range.toDate).toBe('2026-08-22')
    // Half-open: SQL compares `< toExclusiveDate`, which is the first day of شهریور.
    expect(range.toExclusiveDate).toBe('2026-08-23')
  })

  it('starts فروردین on Nowruz', () => {
    expect(jalaliMonthRange(1405, 1).fromDate).toBe('2026-03-21')
  })

  /**
   * The first six Jalali months have 31 days and the next five have 30, so a month's length is not
   * derivable from the Gregorian month it mostly overlaps. These are the cases an off-by-one hides in.
   */
  it('gives each month its own real length', () => {
    const lengthOf = (year: number, month: number) => {
      const range = jalaliMonthRange(year, month)
      const from = Date.parse(`${range.fromDate}T00:00:00Z`)
      const to = Date.parse(`${range.toExclusiveDate}T00:00:00Z`)
      return (to - from) / 86_400_000
    }
    for (const month of [1, 2, 3, 4, 5, 6]) expect(lengthOf(1405, month)).toBe(31)
    for (const month of [7, 8, 9, 10, 11]) expect(lengthOf(1405, month)).toBe(30)
  })

  it('gives اسفند 29 days in an ordinary year and 30 in a leap year', () => {
    const lengthOf = (year: number) => {
      const range = jalaliMonthRange(year, 12)
      return (Date.parse(`${range.toExclusiveDate}T00:00:00Z`) - Date.parse(`${range.fromDate}T00:00:00Z`)) / 86_400_000
    }
    expect(lengthOf(1405)).toBe(29)
    // 1403 is a leap year in the Jalali calendar.
    expect(lengthOf(1403)).toBe(30)
  })

  it('rolls اسفند into فروردین of the next year', () => {
    const esfand = jalaliMonthRange(1405, 12)
    const farvardin = jalaliMonthRange(1406, 1)
    expect(esfand.toExclusiveDate).toBe(farvardin.fromDate)
    expect(previousJalaliMonth(1406, 1)).toEqual({ year: 1405, month: 12 })
    expect(previousJalaliMonth(1405, 5)).toEqual({ year: 1405, month: 4 })
  })

  it('leaves no day belonging to two months, or to none', () => {
    let cursor = jalaliMonthRange(1405, 1).fromDate
    for (let month = 1; month <= 12; month += 1) {
      const range = jalaliMonthRange(1405, month)
      expect(range.fromDate).toBe(cursor)
      cursor = range.toExclusiveDate
    }
    expect(cursor).toBe(jalaliMonthRange(1406, 1).fromDate)
  })

  it('refuses a month number that is not a month', () => {
    expect(() => jalaliMonthRange(1405, 0)).toThrow()
    expect(() => jalaliMonthRange(1405, 13)).toThrow()
  })
})

describe('the current month follows Tehran, not the server clock', () => {
  it('reads the Tehran business day', () => {
    // Tehran is UTC+03:30, so 21:00Z is already 00:30 the next day there — 30 مرداد, not 29.
    expect(jalaliToday(new Date('2026-08-20T21:00:00Z'))).toEqual({ year: 1405, month: 5, day: 30 })
    // The same calendar day in UTC is still the previous Jalali day until that offset is crossed.
    expect(jalaliToday(new Date('2026-08-20T10:00:00Z'))).toEqual({ year: 1405, month: 5, day: 29 })
  })

  it('puts a late-evening instant in the month Tehran is already in', () => {
    // 2026-08-22T21:00Z is 2026-08-23 in Tehran, the first day of شهریور.
    expect(currentJalaliMonth(new Date('2026-08-22T21:00:00Z'))).toEqual({ year: 1405, month: 6 })
    expect(currentJalaliMonth(new Date('2026-08-22T10:00:00Z'))).toEqual({ year: 1405, month: 5 })
  })

  it('lists recent months newest first, crossing the year boundary', () => {
    const months = recentJalaliMonths(3, new Date('2026-04-10T09:00:00Z'))
    expect(months).toEqual([
      { year: 1405, month: 1 },
      { year: 1404, month: 12 },
      { year: 1404, month: 11 },
    ])
  })
})

describe('purchase-to-sales ratio', () => {
  it('reports purchases as a share of sales, to one decimal', () => {
    expect(purchaseToSalesPercent(10_150_000, 17_600_000)).toBe(57.7)
    expect(purchaseToSalesPercent(5_000_000, 10_000_000)).toBe(50)
  })

  it('answers null rather than Infinity or NaN when the month sold nothing', () => {
    // A kitchen screen must never print `Infinity٪`.
    expect(purchaseToSalesPercent(4_000_000, 0)).toBeNull()
    expect(purchaseToSalesPercent(0, 0)).toBeNull()
  })

  it('reports zero when nothing was bought', () => {
    expect(purchaseToSalesPercent(0, 17_600_000)).toBe(0)
  })
})
