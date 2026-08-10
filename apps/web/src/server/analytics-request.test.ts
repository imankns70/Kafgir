import { describe, expect, it, vi } from 'vitest'
import {
  analyticsIdentifiersFromRequest,
  analyticsSessionCookie,
  analyticsVisitorCookie,
  safelyAssociateAnalyticsSession,
} from './analytics-request'

const visitorId = 'bd84c4a6-94aa-4d70-87df-a134fac56b13'
const sessionId = '841ee0f5-2386-40d8-8d77-bda0b4c21ba7'

describe('analytics request isolation', () => {
  it('accepts only valid first-party UUID cookies', () => {
    const valid = new Request('http://localhost', {
      headers: { cookie: `${analyticsVisitorCookie}=${visitorId}; ${analyticsSessionCookie}=${sessionId}` },
    })
    expect(analyticsIdentifiersFromRequest(valid)).toEqual({ visitorId, sessionId })
    const invalid = new Request('http://localhost', {
      headers: { cookie: `${analyticsVisitorCookie}=bad; ${analyticsSessionCookie}=${sessionId}` },
    })
    expect(analyticsIdentifiersFromRequest(invalid)).toBeNull()
  })

  it('does not let analytics persistence failure break authentication', async () => {
    const request = new Request('http://localhost', {
      headers: { cookie: `${analyticsVisitorCookie}=${visitorId}; ${analyticsSessionCookie}=${sessionId}` },
    })
    const failingRecorder = vi.fn().mockRejectedValue(new Error('analytics unavailable'))
    await expect(safelyAssociateAnalyticsSession(request, 17, undefined, failingRecorder))
      .resolves.toBeUndefined()
    expect(failingRecorder).toHaveBeenCalledOnce()
  })
})
