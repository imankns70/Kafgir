import { jalaliMonthTitle, type JalaliMonthRef } from '@kafgir/contracts'
import { toGregorian, toJalaali } from 'jalaali-js'

/**
 * Jalali months as ISO date ranges.
 *
 * Kafgir reports by Persian month, but every date it stores is an ordinary PostgreSQL `date`. Rather
 * than teach SQL the Persian calendar, a month is converted once here into a half-open ISO range and
 * the queries stay plain range scans that use the existing indexes.
 *
 * Half-open on purpose: `purchase_date >= from AND purchase_date < toExclusive`. A closed range
 * invites the classic off-by-one where the last day of اسفند silently belongs to no month.
 *
 * All "what month is it now" questions resolve through the Tehran business day, never the server's
 * local clock — a purchase entered at 01:00 Tehran belongs to that Tehran day.
 */

export type JalaliMonthRange = {
  year: number
  month: number
  title: string
  /** First ISO day of the month, inclusive. */
  fromDate: string
  /** Last ISO day of the month, inclusive. What the UI shows as the end. */
  toDate: string
  /** First ISO day of the following month. What SQL compares against with `<`. */
  toExclusiveDate: string
}

const pad = (value: number) => String(value).padStart(2, '0')

const isoOf = (jy: number, jm: number, jd: number): string => {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return `${String(gy).padStart(4, '0')}-${pad(gm)}-${pad(gd)}`
}

const nextMonth = (year: number, month: number): JalaliMonthRef =>
  month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

export const previousJalaliMonth = (year: number, month: number): JalaliMonthRef =>
  month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }

/** The Tehran business day as a Jalali date. */
export function jalaliToday(now = new Date()): { year: number; month: number; day: number } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const [gy, gm, gd] = iso.split('-').map(Number) as [number, number, number]
  const { jy, jm, jd } = toJalaali(gy, gm, gd)
  return { year: jy, month: jm, day: jd }
}

export function currentJalaliMonth(now = new Date()): JalaliMonthRef {
  const { year, month } = jalaliToday(now)
  return { year, month }
}

/** The ISO range one Jalali month covers. Leap years are handled by the conversion, not by us. */
export function jalaliMonthRange(year: number, month: number): JalaliMonthRange {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid Jalali month: ${month}`)
  }
  const following = nextMonth(year, month)
  const toExclusiveDate = isoOf(following.year, following.month, 1)
  const lastDay = new Date(`${toExclusiveDate}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  return {
    year,
    month,
    title: jalaliMonthTitle(year, month),
    fromDate: isoOf(year, month, 1),
    toDate: lastDay.toISOString().slice(0, 10),
    toExclusiveDate,
  }
}

/** The current month first, then earlier ones. Used to offer a month list without a period table. */
export function recentJalaliMonths(count: number, now = new Date()): JalaliMonthRef[] {
  const months: JalaliMonthRef[] = []
  let cursor = currentJalaliMonth(now)
  for (let index = 0; index < count; index += 1) {
    months.push(cursor)
    cursor = previousJalaliMonth(cursor.year, cursor.month)
  }
  return months
}

/**
 * Purchases as a share of food sales.
 *
 * Null when the month sold nothing: dividing by zero would print `Infinity` or `NaN` on a kitchen
 * screen, and "no sales yet" is the honest answer rather than a number.
 */
export function purchaseToSalesPercent(purchases: number, foodSales: number): number | null {
  if (foodSales <= 0) return null
  return Math.round((purchases / foodSales) * 1000) / 10
}
