export const formatNumber = (value: string | number, maximumFractionDigits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value))

export const formatMoney = (value: number): string => `${formatNumber(value)} تومان`

export const persianDateWithLatinDigitsLocale = 'fa-IR-u-nu-latn'
