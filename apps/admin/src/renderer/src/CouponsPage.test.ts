import { describe, expect, it } from 'vitest'
import { CouponDiscountType } from '@kafgir/contracts'
import { couponRequest, couponSummary } from './CouponsPage'
import { isAdminOperationAllowed } from '../../shared/admin-permissions'

const form = {
  id: null, code: 'kafgir10', title: '', discountType: CouponDiscountType.Percent, value: '۱۰', maxDiscount: '100,000',
  minOrder: '', startsOn: '', endsOn: '', usageLimit: '', perCustomerLimit: '1', firstOrderOnly: false, isActive: true,
}

describe('coupon form', () => {
  it('turns the form into a request and refuses impossible values', () => {
    expect(couponRequest(form)).toMatchObject({ code: 'kafgir10', discountValue: 10, maxDiscountAmount: 100_000, usageLimit: null, perCustomerLimit: 1 })
    expect(couponRequest({ ...form, value: '120' })).toBe('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.')
    expect(couponRequest({ ...form, usageLimit: '0' })).toBe('سقف استفاده باید عدد صحیح مثبت باشد.')
  })

  it('describes a coupon in one line', () => {
    expect(couponSummary({ discountType: CouponDiscountType.Fixed, discountValue: 50_000, maxDiscountAmount: null, minOrderAmount: 300_000 }))
      .toContain('برای سفارش از')
  })

  it('keeps coupons with the owner', () => {
    expect(isAdminOperationAllowed('coupons.create', ['Owner'])).toBe(true)
    expect(isAdminOperationAllowed('coupons.list', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('coupons.list', ['KitchenAdmin'])).toBe(false)
  })
})
