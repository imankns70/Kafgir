import { describe, expect, it } from 'vitest'
import { CouponDiscountType, couponDiscount, normalizeCouponCode } from '@kafgir/contracts'

const percent = (value: number, max: number | null = null, min = 0) =>
  ({ discountType: CouponDiscountType.Percent, discountValue: value, maxDiscountAmount: max, minOrderAmount: min })

describe('couponDiscount', () => {
  it('takes a percentage of the food, rounded down to whole tomans and capped', () => {
    expect(couponDiscount(percent(10), 455_555)).toBe(45_555)
    expect(couponDiscount(percent(20, 50_000), 1_000_000)).toBe(50_000)
  })

  it('never takes more than the food, and nothing below the minimum', () => {
    expect(couponDiscount({ discountType: CouponDiscountType.Fixed, discountValue: 80_000, maxDiscountAmount: null, minOrderAmount: 0 }, 60_000)).toBe(60_000)
    expect(couponDiscount(percent(10, null, 300_000), 299_999)).toBe(0)
    expect(couponDiscount(percent(10), 0)).toBe(0)
  })
})

describe('normalizeCouponCode', () => {
  it('ignores case, spaces, dashes and Persian digits', () => {
    expect(normalizeCouponCode(' kafgir-۱۰ ')).toBe('KAFGIR10')
  })
})
