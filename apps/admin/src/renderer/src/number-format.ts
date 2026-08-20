export const formatNumber = (value: string | number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value))

export const formatMoney = (value: number): string => `${formatNumber(value)} تومان`

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

/**
 * Money entry.
 *
 * Amounts are typed, not just displayed, so the same three rules live here once rather than being
 * re-invented per screen: an operator's keyboard may produce Persian or Arabic-Indic digits, a
 * grouped value pasted back in («70,000») must still read as a number, and arithmetic is always done
 * on the parsed number — never on the formatted string.
 */

const latinDigits = (value: string) => value
  .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

/** Latin, Persian and Arabic-Indic digits all normalise to Latin; separators and spaces drop out. */
export const normalizeAmountText = (value: string): string =>
  latinDigits(value).replace(/[,،٬⁦-⁩\s]/gu, '').trim()

/**
 * Reads a money box. Returns null for anything that is not a non-negative number, including an empty
 * box — clearing a field must not silently mean zero.
 */
export const parseAmount = (value: string): number | null => {
  const normalized = normalizeAmountText(value)
  if (normalized === '') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** The same, for the whole-Toman amounts the courier screens hold. Fractions are rejected. */
export const parseTomanAmount = (value: string): number | null => {
  const parsed = parseAmount(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

/**
 * What a money box shows while it is being edited: grouped digits, no unit. Trailing input the
 * operator is still typing (a lone «.», a partial decimal) is preserved rather than reformatted out
 * from under the caret.
 */
export const formatAmountInput = (value: string | number): string => {
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value) : ''
  const normalized = normalizeAmountText(value)
  if (normalized === '') return ''
  const [whole = '', fraction] = normalized.split('.')
  if (!/^\d*$/u.test(whole) || (fraction !== undefined && !/^\d*$/u.test(fraction))) return value
  const grouped = whole === '' ? '' : formatNumber(whole)
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}
