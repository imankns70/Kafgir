import { describe, expect, it } from 'vitest'
import {
  isLimitedAvailabilityTriggered,
  isSocialRuleEligible,
  isWithinSocialTimeWindow,
} from './automation-rules'

describe('social automation rules', () => {
  it('uses the configured limited-availability threshold', () => {
    expect(isLimitedAvailabilityTriggered(8, 6, 35)).toBe(true)
    expect(isLimitedAvailabilityTriggered(8, 6, 20)).toBe(false)
  })

  it('does not trigger for sold-out or invalid inventory', () => {
    expect(isLimitedAvailabilityTriggered(8, 8, 35)).toBe(false)
    expect(isLimitedAvailabilityTriggered(0, 0, 35)).toBe(false)
  })

  it('supports regular and overnight windows', () => {
    expect(isWithinSocialTimeWindow(8 * 60 + 30, '08:00', '09:30')).toBe(true)
    expect(isWithinSocialTimeWindow(6 * 60, '23:00', '07:00')).toBe(true)
    expect(isWithinSocialTimeWindow(12 * 60, '23:00', '07:00')).toBe(false)
  })

  it('skips disabled and manual rules', () => {
    expect(isSocialRuleEligible({ isEnabled: false, executionMode: 'Suggestion' }, 600)).toBe(false)
    expect(isSocialRuleEligible({ isEnabled: true, executionMode: 'Manual' }, 600)).toBe(false)
    expect(isSocialRuleEligible({ isEnabled: true, executionMode: 'Suggestion' }, 600)).toBe(true)
  })
})
