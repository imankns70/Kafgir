import { OrderStatus } from '@kafgir/contracts'

/**
 * Pure courier pricing and accounting rules, shared by order creation, the customer pricing query,
 * the Admin day view and the settlement service. Keeping them here means those callers cannot drift
 * into four slightly different answers to "what does this order cost, and what do we owe for it".
 */

/**
 * The one status that earns a courier money.
 *
 * `isAllowedOrderTransition` has no outgoing case from `Delivered`, so the status is terminal and
 * current-status accounting is deterministic — an order that has earned can never un-earn. If a
 * backward transition is ever introduced, this becomes the place where an event ledger is needed;
 * until then a durable ledger would be machinery with no failure mode to prevent.
 */
export const courierEarningStatuses = [OrderStatus.Delivered] as const

export function isCourierEarningStatus(status: OrderStatus): boolean {
  return (courierEarningStatuses as readonly OrderStatus[]).includes(status)
}

/** The configuration in force for a delivery date, as read from one consistent row. */
export type CourierDayPricing = {
  courierDeliveryDayId: number
  courierId: number
  courierName: string
  customerDeliveryFee: number
  courierPayablePerOrder: number
}

export type DeliveryMethodPricingInput = {
  requiresCourier: boolean
  /** `delivery_method_settings.delivery_fee`; meaningful only when no courier is involved. */
  methodDeliveryFee: number
  /** The date's active configuration, or null when the day has not been priced yet. */
  courierDay: CourierDayPricing | null
}

export const courierDayMissingMessage = 'هزینه و پیک ارسال برای این روز هنوز مشخص نشده است.'

/**
 * The effective customer charge, or null when a courier method has no configuration for the date.
 *
 * Null is never coerced to zero. A day nobody has priced is not a free-delivery day, and silently
 * charging nothing would also silently make the courier's work unpayable.
 */
export function effectiveCustomerDeliveryFee(input: DeliveryMethodPricingInput): number | null {
  if (!input.requiresCourier) return input.methodDeliveryFee
  return input.courierDay ? input.courierDay.customerDeliveryFee : null
}

/** What to snapshot on the order, or null for a method that needs no courier. */
export function courierSnapshotFor(input: DeliveryMethodPricingInput): CourierDayPricing | null {
  return input.requiresCourier ? input.courierDay : null
}

export type CourierAccountTotals = {
  /** Sum of the payable snapshots of this courier's Delivered orders. */
  earnedAmount: number
  /** Sum of every settlement recorded against this courier. */
  settledAmount: number
}

export function courierOutstanding(totals: CourierAccountTotals): number {
  return totals.earnedAmount - totals.settledAmount
}

/**
 * Whether a settlement may be recorded. Overpaying a courier is not a supported model — there is no
 * credit or advance concept in the system — so a settlement that would push the balance below zero
 * is rejected rather than quietly producing a negative outstanding figure.
 */
export function settlementRejection(amount: number, outstanding: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'مبلغ تسویه باید بیشتر از صفر باشد.'
  if (amount > outstanding) {
    return `مبلغ تسویه از مانده حساب پیک بیشتر است. مانده فعلی ${outstanding.toLocaleString('fa-IR')} تومان است.`
  }
  return null
}
