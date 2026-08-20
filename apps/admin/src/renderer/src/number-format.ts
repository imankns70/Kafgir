/**
 * Non-money figures: counts, quantities, priorities, row numbers. `maximumFractionDigits` exists for
 * inventory quantities, which are genuinely fractional — money never is.
 */
export const formatNumber = (value: string | number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value))

/**
 * Money display and entry, re-exported from `@kafgir/contracts` so Admin, the customer app and
 * server-generated text cannot drift apart. See that module for the reasoning.
 */
export {
  formatAmount,
  formatMoney,
  isInvalidMoneyText,
  moneyInputText,
  normalizeMoneyText,
  parseMoney,
} from '@kafgir/contracts'

export const persianDateWithLatinDigitsLocale = 'fa-IR-u-nu-latn'

/**
 * Every date the operator reads is shown in the Persian calendar.
 *
 * Date *entry* is a separate concern: the pickers are native Gregorian inputs, because the stored
 * value and every API contract are ISO `YYYY-MM-DD`. These helpers are the display half of that
 * split, so a screen never accidentally prints the raw ISO string next to Jalali columns.
 *
 * Digits stay Latin (`-u-nu-latn`): the admin mixes dates with order numbers, prices and phone
 * numbers, all of which are Latin, and switching only dates to Persian digits reads worse.
 */
const persianDate = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, { timeZone: 'Asia/Tehran', ...options })

/** A calendar day, e.g. `1405/5/26`. Accepts an ISO date, an ISO timestamp or a `Date`. */
export const formatPersianDate = (value: string | Date | null | undefined): string => {
  if (value == null || value === '') return '—'
  // A bare `YYYY-MM-DD` parses as UTC midnight, which is the previous day in Tehran. Anchoring at
  // midday keeps the calendar day the operator picked.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? new Date(`${value}T12:00:00+03:30`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : persianDate({ dateStyle: 'short' }).format(date)
}

/** A day and clock time, e.g. `1405/5/26، 14:35`. */
export const formatPersianDateTime = (value: string | Date | null | undefined): string => {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : persianDate({ dateStyle: 'short', timeStyle: 'short' }).format(date)
}
