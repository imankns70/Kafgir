'use client'

import type { AnalyticsHeartbeatResponse } from '@kafgir/contracts'
import { randomUuid } from '../utils/uuid'

const visitorKey = 'kafgir.analytics.visitor'
const sessionKey = 'kafgir.analytics.session'
const lastActivityKey = 'kafgir.analytics.lastActivity'
const sessionInactivityMs = 30 * 60_000
const heartbeatIntervalMs = 2 * 60_000
let heartbeatInFlight: Promise<void> | null = null

function storageValue(key: string) {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function storeValue(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* Persistence is best effort. */ }
}

function validUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
}

/**
 * Identifiers for this heartbeat, or `null` when one had to be minted and no secure random source
 * exists. A stored id is only ever replaced when it is missing or invalid, so a browser without
 * usable crypto still keeps reporting under identifiers it already holds.
 */
function analyticsIdentity(now: number) {
  let visitorId = storageValue(visitorKey)
  if (!validUuid(visitorId)) {
    visitorId = randomUuid()
    if (visitorId === null) return null
    storeValue(visitorKey, visitorId)
  }
  let sessionId = storageValue(sessionKey)
  const lastActivity = Number(storageValue(lastActivityKey) ?? 0)
  if (!validUuid(sessionId) || !Number.isFinite(lastActivity) || now - lastActivity > sessionInactivityMs) {
    sessionId = randomUuid()
    if (sessionId === null) return null
    storeValue(sessionKey, sessionId)
  }
  storeValue(lastActivityKey, String(now))
  return { visitorId, sessionId }
}

export function trackCustomerActivity() {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return Promise.resolve()
  if (heartbeatInFlight) return heartbeatInFlight
  const identifiers = analyticsIdentity(Date.now())
  // Analytics is never allowed to break the page it observes, so an unusable environment is a quiet
  // no-op rather than a throw out of a `void`-called function.
  if (identifiers === null) return Promise.resolve()
  heartbeatInFlight = fetch('/api/analytics/heartbeat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identifiers),
    keepalive: true,
  }).then(async (response) => {
    if (!response.ok) return
    const result = await response.json() as AnalyticsHeartbeatResponse
    if (validUuid(result.visitorId)) storeValue(visitorKey, result.visitorId)
    if (validUuid(result.sessionId)) storeValue(sessionKey, result.sessionId)
  }).catch(() => {
    // Analytics is intentionally isolated from menu, login, cart, checkout and payment behavior.
  }).finally(() => { heartbeatInFlight = null })
  return heartbeatInFlight
}

export function startCustomerAnalytics() {
  void trackCustomerActivity()
  const timer = window.setInterval(() => void trackCustomerActivity(), heartbeatIntervalMs)
  const onVisibility = () => { if (document.visibilityState === 'visible') void trackCustomerActivity() }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
