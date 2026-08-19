/**
 * Rules protecting the checkout method configuration.
 *
 * `createOrder` refuses any method that is not enabled for the channel the order came from. Switching
 * off the last customer-facing payment or delivery method therefore does not pause ordering politely
 * — every checkout fails with "this method is not active", which reads like a bug rather than a
 * decision. Closing the kitchen is what `daily_menus.is_open` is for.
 *
 * Pure so the rule can be tested without a database; the service supplies the counts.
 */

/** How many *other* rows are still enabled per channel. */
export type RemainingChannelOptions = {
  customer: number
  manual: number
}

export type ChannelAvailability = {
  isCustomerEnabled: boolean
  isManualEnabled: boolean
}

export type EmptyChannel = 'customer' | 'manual' | null

/**
 * Which channel the update would leave with nothing selectable, or `null` when it is safe.
 *
 * The customer channel is reported first: a broken public checkout is the more expensive failure.
 */
export function channelLeftWithoutOption(
  remaining: RemainingChannelOptions,
  next: ChannelAvailability,
): EmptyChannel {
  if (!next.isCustomerEnabled && remaining.customer === 0) return 'customer'
  if (!next.isManualEnabled && remaining.manual === 0) return 'manual'
  return null
}

const channelText: Record<Exclude<EmptyChannel, null>, string> = {
  customer: 'وب مشتری',
  manual: 'سفارش دستی',
}

export function channelLeftWithoutOptionMessage(subject: string, channel: Exclude<EmptyChannel, null>) {
  return `${subject} باید دست‌کم یک گزینه فعال برای ${channelText[channel]} داشته باشد.`
}
