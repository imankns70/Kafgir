/**
 * Counts, quantities and order numbers, printed as they are. These are not money: an order number
 * is an identifier and grouping it would invent digits that are not in it.
 */
export const formatNumber = (value: string | number): string => String(value)

/**
 * Prices, fees and totals. Re-exported from `@kafgir/contracts` so the customer app, Admin and the
 * server all print «1,260,000 تومان» identically; see that module for why the rules live there.
 */
export { formatMoney } from '@kafgir/contracts'

/** «سه‌شنبه ۲۱ مرداد» for an ISO business date. Latin digits, per the project's numeric convention —
 *  Vazir FD renders their Persian glyphs without changing the underlying characters. */
export const formatPersianDay = (isoDate: string): string =>
  persianDayFormat.format(new Date(`${isoDate}T12:00:00+03:30`))

/** The pieces of {@link formatPersianDay}, for layouts that set the day number apart from its names. */
export const persianDayParts = (isoDate: string): { weekday: string; day: string; month: string } => {
  const parts = persianDayFormat.formatToParts(new Date(`${isoDate}T12:00:00+03:30`))
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { weekday: pick('weekday'), day: pick('day'), month: pick('month') }
}

const persianDayFormat = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
  timeZone: 'Asia/Tehran',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** «۱۲:۰۰ تا ۱۴:۰۰» from two `HH:MM` values. */
export const formatDeliveryWindow = (startTime: string, endTime: string): string =>
  `${startTime} تا ${endTime}`

export const formatPersianDateTime = (value: string): string =>
  new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(new Date(value))
