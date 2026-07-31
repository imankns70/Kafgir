import { AppError } from '../errors'

export function normalizeIranianMobile(value: string): string {
  const digits = value.trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^\d+]/g, '')
  const normalized = digits.startsWith('+98')
    ? `0${digits.slice(3)}`
    : digits.startsWith('0098')
      ? `0${digits.slice(4)}`
      : digits.startsWith('98') && digits.length === 12
        ? `0${digits.slice(2)}`
        : digits
  if (!/^09\d{9}$/.test(normalized)) {
    throw new AppError('شماره موبایل باید یک شماره معتبر ایران باشد.')
  }
  return normalized
}
