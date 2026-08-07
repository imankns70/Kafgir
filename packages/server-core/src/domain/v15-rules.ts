import { PaymentStatus } from '@kafgir/contracts'

export function grossQuantityFactor(
  wastePercent: number | null | undefined,
  preparationLossPercent: number | null | undefined,
): number {
  const wasteYield = 1 - (wastePercent ?? 0) / 100
  const preparationYield = 1 - (preparationLossPercent ?? 0) / 100
  if (wasteYield <= 0 || preparationYield <= 0) {
    throw new Error('درصد افت باید کمتر از صد باشد.')
  }
  return 1 / wasteYield / preparationYield
}

export function isAllowedPaymentTransition(current: PaymentStatus, next: PaymentStatus): boolean {
  if (![PaymentStatus.Pending, PaymentStatus.AwaitingVerification].includes(current)) return false
  return [
    PaymentStatus.Paid,
    PaymentStatus.Failed,
    PaymentStatus.Rejected,
    PaymentStatus.Cancelled,
  ].includes(next)
}
