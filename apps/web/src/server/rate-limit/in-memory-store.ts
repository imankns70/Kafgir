import type { IRateLimitStore, RateLimitDecision, RateLimitPolicy } from './store'

/**
 * V1 rate-limit store: fixed windows held in this process's heap.
 *
 * ## Concurrency assumption
 *
 * Node runs JavaScript on one thread, so any run of statements containing no `await` cannot be
 * interleaved with another task. {@link InMemoryRateLimitStore.consumeSync} relies on exactly that:
 * its read-modify-write is entirely synchronous, which makes it atomic without a lock.
 *
 * This is a load-bearing invariant, not a style preference. Introducing a single `await` inside that
 * method — even an already-resolved one — yields to the event loop between reading the counter and
 * writing it back, letting concurrent requests observe the same pre-state and all be allowed past
 * the limit. `consume` therefore wraps the synchronous result in a promise rather than being async
 * itself. There is a test asserting the budget holds under concurrent consumes.
 *
 * ## Not distributed
 *
 * State is per process. Two application instances keep two independent budgets, so the effective
 * limit multiplies by the instance count. V1 is deployed single-instance; `isDistributed` is `false`
 * so callers needing a cluster-wide guarantee can detect this rather than assume it.
 */

type WindowEntry = {
  count: number
  /** Epoch milliseconds at which this window ends and the slot becomes reclaimable. */
  resetAt: number
}

export type InMemoryRateLimitStoreOptions = {
  /** Hard ceiling on tracked windows. Bounds heap use against key-flooding. */
  maxTrackedKeys?: number
  /** Period of the background sweep. */
  sweepIntervalMs?: number
  /** Set false in tests that drive {@link InMemoryRateLimitStore.sweep} explicitly. */
  startSweep?: boolean
}

const defaultMaxTrackedKeys = 10_000
const defaultSweepIntervalMs = 60_000

const secondsUntil = (resetAt: number, now: number) =>
  Math.max(1, Math.ceil((resetAt - now) / 1000))

export class InMemoryRateLimitStore implements IRateLimitStore {
  readonly isDistributed = false

  readonly #windows = new Map<string, WindowEntry>()
  readonly #maxTrackedKeys: number
  #sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: InMemoryRateLimitStoreOptions = {}) {
    this.#maxTrackedKeys = options.maxTrackedKeys ?? defaultMaxTrackedKeys
    if (options.startSweep ?? true) {
      this.#startSweep(options.sweepIntervalMs ?? defaultSweepIntervalMs)
    }
  }

  consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision> {
    return Promise.resolve(this.consumeSync(key, policy))
  }

  /**
   * The critical section. Must contain no `await` — see the class comment.
   *
   * Exposed synchronously so tests can assert the atomicity property directly; request paths should
   * use {@link consume}.
   */
  consumeSync(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    const composite = `${policy.name}:${key}`
    const existing = this.#windows.get(composite)

    if (existing && existing.resetAt > now) {
      if (existing.count >= policy.limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt, retryAfterSeconds: secondsUntil(existing.resetAt, now) }
      }
      existing.count += 1
      return { allowed: true, remaining: policy.limit - existing.count, resetAt: existing.resetAt, retryAfterSeconds: 0 }
    }

    // Either unknown, or the previous window lapsed. An expired entry is reused in place, so a
    // returning caller never counts against the key cap — that is the lazy half of expiration.
    if (!existing && this.#windows.size >= this.#maxTrackedKeys) {
      const earliestReset = this.#reclaim(now)
      if (this.#windows.size >= this.#maxTrackedKeys) {
        // Fail closed. Admitting an untracked request would hand out an unlimited budget to whoever
        // filled the store, which is precisely the attack the cap exists to stop.
        const resetAt = earliestReset ?? now + policy.windowMs
        return { allowed: false, remaining: 0, resetAt, retryAfterSeconds: secondsUntil(resetAt, now) }
      }
    }

    const resetAt = now + policy.windowMs
    this.#windows.set(composite, { count: 1, resetAt })
    return { allowed: true, remaining: policy.limit - 1, resetAt, retryAfterSeconds: 0 }
  }

  /**
   * Drops lapsed windows and reports the earliest reset still outstanding.
   *
   * Only expired entries are ever removed. A live entry is never evicted to make room, even under
   * pressure: evicting one that had reached its limit would give the caller behind it a fresh
   * budget, turning the memory bound into a bypass.
   */
  #reclaim(now: number): number | null {
    let earliestReset: number | null = null
    for (const [key, entry] of this.#windows) {
      if (entry.resetAt <= now) {
        this.#windows.delete(key)
        continue
      }
      if (earliestReset === null || entry.resetAt < earliestReset) earliestReset = entry.resetAt
    }
    return earliestReset
  }

  /** Removes lapsed windows. Returns how many were dropped. Called by the timer and by tests. */
  sweep(now = Date.now()): number {
    const before = this.#windows.size
    this.#reclaim(now)
    return before - this.#windows.size
  }

  #startSweep(intervalMs: number) {
    const timer = setInterval(() => this.sweep(), intervalMs)
    // Without this the interval is an active handle and Node will not exit on its own — the process
    // would hang on shutdown and vitest would never finish.
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref()
    this.#sweepTimer = timer
  }

  /** Stops the background sweep. Tests and graceful shutdown only. */
  stopSweep() {
    if (this.#sweepTimer !== null) {
      clearInterval(this.#sweepTimer)
      this.#sweepTimer = null
    }
  }

  clear(): Promise<void> {
    this.#windows.clear()
    return Promise.resolve()
  }

  /** Number of tracked windows, including lapsed ones not yet reclaimed. */
  get trackedKeys(): number {
    return this.#windows.size
  }

  /**
   * Whether the sweep timer is holding the event loop open. Should be `false` whenever a timer
   * exists; `null` when no timer is running.
   */
  sweepTimerHoldsProcessOpen(): boolean | null {
    const timer = this.#sweepTimer
    if (timer === null) return null
    return typeof timer === 'object' && 'hasRef' in timer ? timer.hasRef() : true
  }
}
