import { describe, expect, it } from 'vitest'
import {
  analyticsHeartbeatWriteThrottleMs,
  analyticsSessionInactivityMs,
  isAnalyticsSessionExpired,
  shouldWriteAnalyticsHeartbeat,
} from './customer-analytics-service'

describe('customer analytics timing rules', () => {
  const lastSeen = new Date('2026-08-09T08:00:00.000Z')

  it('starts a new session only after more than 30 minutes of inactivity', () => {
    expect(isAnalyticsSessionExpired(lastSeen,
      new Date(lastSeen.getTime() + analyticsSessionInactivityMs))).toBe(false)
    expect(isAnalyticsSessionExpired(lastSeen,
      new Date(lastSeen.getTime() + analyticsSessionInactivityMs + 1))).toBe(true)
  })

  it('throttles database heartbeat writes for 60 seconds', () => {
    expect(shouldWriteAnalyticsHeartbeat(lastSeen,
      new Date(lastSeen.getTime() + analyticsHeartbeatWriteThrottleMs - 1))).toBe(false)
    expect(shouldWriteAnalyticsHeartbeat(lastSeen,
      new Date(lastSeen.getTime() + analyticsHeartbeatWriteThrottleMs))).toBe(true)
  })
})
