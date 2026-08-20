import { describe, expect, it } from 'vitest'
import { formatMoney, formatNumber, formatPersianDateTime } from './format'

const persianDigitPattern = /[۰-۹]/

describe('web number formatting', () => {
  it('uses Latin digits and keeps grouped prices', () => {
    expect(formatNumber(12)).toBe('12')
    expect(formatMoney(550000)).toBe('550,000 تومان')
  })

  it('groups every figure a checkout breakdown shows', () => {
    // جمع غذاها / هزینه ارسال / مبلغ نهایی. The total is computed from the numbers and only then
    // formatted — nothing here ever adds up formatted strings.
    const subtotal = 480_000
    const deliveryFee = 70_000
    expect(formatMoney(subtotal)).toBe('480,000 تومان')
    expect(formatMoney(deliveryFee)).toBe('70,000 تومان')
    expect(formatMoney(subtotal + deliveryFee)).toBe('550,000 تومان')
  })

  it('shows a zero delivery fee as a real figure rather than an empty cell', () => {
    expect(formatMoney(0)).toBe('0 تومان')
  })

  it('uses Latin digits in Persian calendar dates', () => {
    const value = formatPersianDateTime('2026-07-31T12:00:00.000Z')
    expect(value).not.toMatch(persianDigitPattern)
    expect(value).toContain('1405')
  })
})
