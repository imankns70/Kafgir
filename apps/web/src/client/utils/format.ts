export const formatNumber = (value: string | number): string => String(value)

export const formatMoney = (amount: number): string =>
  `${new Intl.NumberFormat('en-US').format(amount)} تومان`

export const formatPersianDateTime = (value: string): string =>
  new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(new Date(value))
