export const formatNumber = (value: string | number): string => String(value)

export const formatMoney = (amount: number): string =>
  `${new Intl.NumberFormat('en-US').format(amount)} تومان`

/** «سه‌شنبه ۲۱ مرداد» for an ISO business date. Latin digits, per the project's numeric convention —
 *  Vazir FD renders their Persian glyphs without changing the underlying characters. */
export const formatPersianDay = (isoDate: string): string =>
  new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    timeZone: 'Asia/Tehran',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${isoDate}T12:00:00+03:30`))

/** «۱۲:۰۰ تا ۱۴:۰۰» from two `HH:MM` values. */
export const formatDeliveryWindow = (startTime: string, endTime: string): string =>
  `${startTime} تا ${endTime}`

export const formatPersianDateTime = (value: string): string =>
  new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(new Date(value))
