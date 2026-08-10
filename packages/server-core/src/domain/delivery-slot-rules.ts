import { DeliverySlotUnavailableReason } from '@kafgir/contracts'

/**
 * Pure availability rules for delivery windows, shared by the customer availability query, order
 * creation and the Admin day view. Keeping them here means the three callers cannot drift into three
 * slightly different definitions of "available", which is what makes overselling and
 * disagree-with-the-server UI bugs possible.
 */

export type SlotRuleInput = {
  /** Master `is_active`. */
  isActiveGlobally: boolean
  /** Per-date override, when a row exists for this date. */
  override: { isAvailable: boolean; capacityOrders: number | null } | null
  startTime: string
  orderCutoffMinutesBeforeStart: number
  /** Orders already occupying this window (statuses that consume capacity). */
  usedOrders: number
}

/** `HH:MM` or `HH:MM:SS` to minutes past midnight. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':')
  const total = Number(hours) * 60 + Number(minutes)
  if (!Number.isInteger(total)) throw new Error(`Invalid time value: ${time}`)
  return total
}

/** PostgreSQL `time` comes back as `HH:MM:SS`; the API and both UIs speak `HH:MM`. */
export function toTimeOfDay(value: string): string {
  return value.slice(0, 5)
}

/**
 * The effective capacity limit. A date override may set one; without an override there is no
 * slot-level limit, because master data describes when we deliver, not how much.
 */
export function slotCapacity(input: SlotRuleInput): number | null {
  return input.override?.capacityOrders ?? null
}

/**
 * Effective availability: global active flag, then the optional date override, then cutoff, then
 * capacity. Order matters — the reason shown to the customer should be the first real obstacle, and
 * "this day is off" is more useful than "it is full".
 *
 * `nowMinutes` and `isDeliveryDateToday` must both be derived from the business timezone by the
 * caller; this function never reads the clock itself so it stays testable and timezone-honest.
 */
export function evaluateSlot(
  input: SlotRuleInput,
  nowMinutes: number,
  isDeliveryDateToday: boolean,
  isDeliveryDateInPast: boolean,
): DeliverySlotUnavailableReason | null {
  if (!input.isActiveGlobally) return DeliverySlotUnavailableReason.Inactive
  if (input.override && !input.override.isAvailable) return DeliverySlotUnavailableReason.DisabledForDate
  if (isDeliveryDateInPast) return DeliverySlotUnavailableReason.CutoffPassed
  if (isDeliveryDateToday) {
    const closesAt = minutesOfDay(input.startTime) - input.orderCutoffMinutesBeforeStart
    if (nowMinutes >= closesAt) return DeliverySlotUnavailableReason.CutoffPassed
  }
  const capacity = slotCapacity(input)
  if (capacity !== null && input.usedOrders >= capacity) return DeliverySlotUnavailableReason.CapacityFull
  return null
}

const reasonMessages: Record<DeliverySlotUnavailableReason, string> = {
  [DeliverySlotUnavailableReason.Inactive]: 'این بازه ارسال غیرفعال است.',
  [DeliverySlotUnavailableReason.DisabledForDate]: 'این بازه برای روز انتخابی فعال نیست.',
  [DeliverySlotUnavailableReason.CutoffPassed]: 'زمان انتخاب این بازه گذشته است.',
  [DeliverySlotUnavailableReason.CapacityFull]:
    'متأسفانه ظرفیت این بازه زمانی تکمیل شده است. لطفاً زمان دیگری انتخاب کنید.',
}

export function deliverySlotUnavailableMessage(reason: DeliverySlotUnavailableReason): string {
  return reasonMessages[reason]
}
