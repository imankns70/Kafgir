/**
 * Storage contract for rate limiting.
 *
 * The contract is async from day one even though the V1 implementation resolves synchronously.
 * A future `RedisRateLimitStore` is genuinely async, and retrofitting `await` later would mean
 * touching every call site — so callers are written against promises from the start.
 *
 * Implementations receive already-derived, non-reversible keys. Raw phone numbers, IP addresses,
 * tokens and other identifiers must never reach a store.
 */

import { AppError } from '../errors'

/**
 * A 429 raised from inside a service, where the limit depends on request data the route boundary
 * cannot see — the OTP phone number, for example, arrives in the body.
 *
 * Extends `AppError` so the existing `routeError` funnel already produces the right status and body
 * shape; the extra field only adds `Retry-After`.
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    readonly context?: {
      readonly policy: string
      readonly operation: string
      readonly storeDistributed: boolean
    },
  ) {
    super(message, 429)
  }
}

export type RateLimitDecision = {
  /** False when the caller has exhausted the policy budget for the current window. */
  allowed: boolean
  /** Remaining budget in the current window. Never surfaced to clients. */
  remaining: number
  /** Epoch milliseconds at which the current window ends. */
  resetAt: number
  /** Whole seconds to wait before retrying. `0` when allowed, otherwise at least `1`. */
  retryAfterSeconds: number
}

export type RateLimitPolicy = {
  /** Namespaces keys and separates policies that share an identity. Never contains user data. */
  readonly name: string
  /** Permitted consumes per window. */
  readonly limit: number
  /** Window length in milliseconds. */
  readonly windowMs: number
  /** Customer-facing Persian message for a 429 from this policy. */
  readonly message?: string
}

export interface IRateLimitStore {
  /**
   * Records one use of `key` under `policy` and reports whether it is permitted.
   *
   * Implementations must be atomic per key: two overlapping calls may never both observe the same
   * pre-state and both be allowed past the limit.
   */
  consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision>

  /** Drops all tracked state. Intended for tests and maintenance, not request paths. */
  clear(): Promise<void>

  /**
   * False for any store whose state lives in one process. Callers that need a cluster-wide
   * guarantee must check this rather than assuming.
   */
  readonly isDistributed: boolean
}
