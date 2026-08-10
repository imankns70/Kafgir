import type { SocialExecutionMode } from '@kafgir/contracts'

export const socialTimeMinutes = (time: string | null | undefined) => {
  if (!time) return null
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function isWithinSocialTimeWindow(
  currentMinutes: number,
  start?: string | null,
  end?: string | null,
) {
  const from = socialTimeMinutes(start)
  const to = socialTimeMinutes(end)
  if (from == null || to == null) return true
  return from <= to
    ? currentMinutes >= from && currentMinutes <= to
    : currentMinutes >= from || currentMinutes <= to
}

export function isLimitedAvailabilityTriggered(
  initialCapacity: number,
  soldQuantity: number,
  thresholdPercentage: number,
) {
  if (initialCapacity <= 0 || soldQuantity < 0 || soldQuantity >= initialCapacity) return false
  const remainingPercentage = ((initialCapacity - soldQuantity) * 100) / initialCapacity
  return remainingPercentage <= thresholdPercentage
}

export function isSocialRuleEligible(value: {
  isEnabled: boolean
  executionMode: SocialExecutionMode
  startTime?: string | null
  endTime?: string | null
}, currentMinutes: number) {
  return value.isEnabled && value.executionMode !== 'Manual' &&
    isWithinSocialTimeWindow(currentMinutes, value.startTime, value.endTime)
}
