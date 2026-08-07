import { PaymentStatus } from '@kafgir/contracts'
import { describe, expect, it } from 'vitest'
import { grossQuantityFactor, isAllowedPaymentTransition } from './v15-rules'

describe('Kafgir 1.5 domain rules', () => {
  it('converts net recipe quantities to gross input using yield loss', () => {
    expect(grossQuantityFactor(10, 20)).toBeCloseTo(1 / 0.9 / 0.8, 10)
    expect(100 * grossQuantityFactor(10, 20)).toBeCloseTo(138.8888889, 6)
  })

  it('allows verification outcomes only from unsettled payment states', () => {
    expect(isAllowedPaymentTransition(PaymentStatus.Pending, PaymentStatus.Paid)).toBe(true)
    expect(isAllowedPaymentTransition(PaymentStatus.AwaitingVerification, PaymentStatus.Rejected)).toBe(true)
    expect(isAllowedPaymentTransition(PaymentStatus.Paid, PaymentStatus.Rejected)).toBe(false)
    expect(isAllowedPaymentTransition(PaymentStatus.Pending, PaymentStatus.Refunded)).toBe(false)
  })
})
