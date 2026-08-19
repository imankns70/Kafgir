import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

/**
 * Jalali calendar arithmetic for the admin date picker.
 *
 * Kept apart from the component so the grid maths — which is where an off-by-one silently shifts
 * every date in the app by a day — is unit tested without rendering anything.
 *
 * The stored value is always ISO Gregorian `YYYY-MM-DD`, because that is what every API contract and
 * database column uses. Jalali exists only between the operator's eyes and that string.
 */

export const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

/** Persian weeks start on Saturday. */
export const persianWeekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

export type JalaliDate = { jy: number; jm: number; jd: number }

const pad = (value: number) => String(value).padStart(2, '0')

/** `1405/4/28` → `2026-07-19`. */
export function toIsoDate({ jy, jm, jd }: JalaliDate): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return `${String(gy).padStart(4, '0')}-${pad(gm)}-${pad(gd)}`
}

/** `2026-07-19` → `1405/4/28`, or `null` when the string is not a usable ISO date. */
export function fromIsoDate(value: string | null | undefined): JalaliDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const gregorian = new Date(Date.UTC(year, month - 1, day))
  // Rejects impossible input like `2026-02-31`, which `toJalaali` would happily convert.
  if (gregorian.getUTCMonth() !== month - 1 || gregorian.getUTCDate() !== day) return null
  return toJalaali(year, month, day)
}

/** The Jalali date in Tehran right now. */
export function todayJalali(now = new Date()): JalaliDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return fromIsoDate(parts) ?? toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export const monthLength = (jy: number, jm: number) => jalaaliMonthLength(jy, jm)

/**
 * Column of the month's first day, where 0 is Saturday.
 *
 * `Date.getDay()` counts from Sunday, so the shift by one turns Saturday into the leading column
 * that a Persian calendar expects.
 */
export function firstWeekdayOffset(jy: number, jm: number): number {
  const { gy, gm, gd } = toGregorian(jy, jm, 1)
  return (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7
}

/**
 * One month laid out for rendering: leading blanks, then every day.
 *
 * `null` marks a cell before the first of the month. Trailing blanks are not emitted — CSS grid
 * handles a short final row, and padding them would invite rendering a day that is not in the month.
 */
export function monthGrid(jy: number, jm: number): Array<number | null> {
  const blanks = Array.from({ length: firstWeekdayOffset(jy, jm) }, () => null)
  const days = Array.from({ length: monthLength(jy, jm) }, (_, index) => index + 1)
  return [...blanks, ...days]
}

/** Moves by whole months, clamping the day so «۳۱ فروردین» → «۳۰ اردیبهشت» rather than overflowing. */
export function shiftMonth({ jy, jm, jd }: JalaliDate, delta: number): JalaliDate {
  const total = (jy * 12) + (jm - 1) + delta
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return { jy: year, jm: month, jd: Math.min(jd, monthLength(year, month)) }
}

export const isSameJalaliDate = (left: JalaliDate | null, right: JalaliDate | null) =>
  left != null && right != null && left.jy === right.jy && left.jm === right.jm && left.jd === right.jd

/** «۲۸ تیر ۱۴۰۵» for the field read-out and the picker header. */
export function formatJalali({ jy, jm, jd }: JalaliDate): string {
  return `${jd} ${persianMonths[jm - 1]} ${jy}`
}
