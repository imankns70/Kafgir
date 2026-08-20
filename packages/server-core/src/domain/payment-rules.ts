import { PaymentStatus } from '@kafgir/contracts'

/**
 * A payment may only be resolved once, and only from a state that is still open. Nothing reopens: a
 * refused or refunded payment is recorded by adding another payment, not by editing the old one.
 */
export function isAllowedPaymentTransition(current: PaymentStatus, next: PaymentStatus): boolean {
  if (![PaymentStatus.Pending, PaymentStatus.AwaitingVerification].includes(current)) return false
  return [
    PaymentStatus.Paid,
    PaymentStatus.Failed,
    PaymentStatus.Rejected,
    PaymentStatus.Cancelled,
  ].includes(next)
}
