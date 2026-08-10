import { NextResponse } from 'next/server'
import { resolveClientIp } from '../client-ip'
import { InMemoryRateLimitStore } from './in-memory-store'
import { rateLimitKey } from './key'
import { logRateLimitRejection } from './observability'
import { defaultRateLimitMessage } from './policies'
import type { IRateLimitStore, RateLimitDecision, RateLimitPolicy } from './store'

export type { IRateLimitStore, RateLimitDecision, RateLimitPolicy } from './store'
export { InMemoryRateLimitStore } from './in-memory-store'
export { rateLimitKey } from './key'
export { rateLimitPolicies, defaultRateLimitMessage } from './policies'
export type { RateLimitPolicyName } from './policies'

/**
 * Next.js evaluates route modules independently and re-evaluates them on every edit in dev. A plain
 * module-level `const` would therefore produce several stores, and each would carry its own budget —
 * so the limiter is pinned to a well-known symbol on `globalThis`.
 */
const storeSymbol = Symbol.for('kafgir.rateLimitStore')

type StoreHolder = { [storeSymbol]?: IRateLimitStore }

export function rateLimitStore(): IRateLimitStore {
  const holder = globalThis as StoreHolder
  holder[storeSymbol] ??= new InMemoryRateLimitStore()
  return holder[storeSymbol]
}

/** Replaces the process-wide store. Tests and a future Redis swap only. */
export function setRateLimitStore(store: IRateLimitStore | null) {
  const holder = globalThis as StoreHolder
  if (store === null) delete holder[storeSymbol]
  else holder[storeSymbol] = store
}

export type RateLimitOptions = {
  policy: RateLimitPolicy
  /** Stable safe operation name for rejection logs. Defaults to the policy name. */
  operation?: string
  /**
   * Extracts the raw identity to limit. Defaults to the trusted client IP.
   *
   * The returned value is hashed before it reaches the store, so returning a phone number or
   * customer id here is safe — but returning something a caller fully controls is not, because they
   * could then mint themselves a fresh bucket per request.
   */
  identify?: (request: Request) => string
}

/**
 * Builds the 429. Deliberately carries no `X-RateLimit-*` headers: the limit, the remaining budget
 * and the window length are all information an attacker would use to pace themselves precisely.
 * `Retry-After` is the one value a well-behaved client legitimately needs.
 */
export function rateLimitResponse(
  decision: RateLimitDecision,
  policy: RateLimitPolicy,
  operation = policy.name,
  storeDistributed = rateLimitStore().isDistributed,
) {
  logRateLimitRejection({
    policy: policy.name,
    operation,
    retryAfterSeconds: decision.retryAfterSeconds,
    storeDistributed,
  })
  return NextResponse.json(
    { error: policy.message ?? defaultRateLimitMessage },
    { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } },
  )
}

type RateLimitedHandler<TArgs extends unknown[]> =
  (request: Request, ...args: TArgs) => Promise<Response> | Response

/**
 * Wraps a route handler so the policy is checked before any application work runs.
 *
 * Applied at the API boundary rather than inside services, so business logic stays unaware of both
 * the policy and the storage implementation. Deliberately not `middleware.ts`: Next middleware runs
 * on the Edge runtime, where the Node APIs this depends on are unavailable.
 */
export function withRateLimit<TArgs extends unknown[]>(
  options: RateLimitOptions,
  handler: RateLimitedHandler<TArgs>,
): RateLimitedHandler<TArgs> {
  const identify = options.identify ?? resolveClientIp
  return async (request, ...args) => {
    const key = rateLimitKey(options.policy.name, identify(request))
    const store = rateLimitStore()
    const decision = await store.consume(key, options.policy)
    if (!decision.allowed) {
      return rateLimitResponse(decision, options.policy, options.operation, store.isDistributed)
    }
    return handler(request, ...args)
  }
}
