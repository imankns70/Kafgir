import { describe, expect, it } from 'vitest'
import { InMemoryRateLimitStore } from './in-memory-store'
import type { RateLimitPolicy } from './store'

const policy = (overrides: Partial<RateLimitPolicy> = {}): RateLimitPolicy => ({
  name: 'test',
  limit: 3,
  windowMs: 60_000,
  ...overrides,
})

/** Stores under test drive `sweep` explicitly so expiration is deterministic rather than timed. */
const store = (options: Partial<ConstructorParameters<typeof InMemoryRateLimitStore>[0]> = {}) =>
  new InMemoryRateLimitStore({ startSweep: false, ...options })

describe('consume', () => {
  it('allows the first consume', async () => {
    const decision = await store().consume('a', policy())
    expect(decision.allowed).toBe(true)
    expect(decision.remaining).toBe(2)
    expect(decision.retryAfterSeconds).toBe(0)
  })

  it('enforces the configured limit', async () => {
    const subject = store()
    const limit = policy({ limit: 3 })
    const outcomes = [
      await subject.consume('a', limit),
      await subject.consume('a', limit),
      await subject.consume('a', limit),
      await subject.consume('a', limit),
    ]
    expect(outcomes.map((outcome) => outcome.allowed)).toEqual([true, true, true, false])
    expect(outcomes[2]!.remaining).toBe(0)
  })

  it('keeps refusing once the budget is spent', async () => {
    const subject = store()
    const limit = policy({ limit: 1 })
    await subject.consume('a', limit)
    expect((await subject.consume('a', limit)).allowed).toBe(false)
    expect((await subject.consume('a', limit)).allowed).toBe(false)
  })
})

describe('retryAfter and reset', () => {
  it('reports the remaining window, rounded up to whole seconds', () => {
    const subject = store()
    const limit = policy({ limit: 1, windowMs: 30_000 })
    const now = 1_000_000
    subject.consumeSync('a', limit, now)
    const denied = subject.consumeSync('a', limit, now + 4_500)
    expect(denied.allowed).toBe(false)
    expect(denied.resetAt).toBe(now + 30_000)
    expect(denied.retryAfterSeconds).toBe(26) // ceil(25.5)
  })

  it('never reports zero seconds while denied', () => {
    const subject = store()
    const limit = policy({ limit: 1, windowMs: 1_000 })
    const now = 1_000_000
    subject.consumeSync('a', limit, now)
    const denied = subject.consumeSync('a', limit, now + 999)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterSeconds).toBe(1)
  })

  it('keeps the window anchored to its first consume rather than sliding', () => {
    const subject = store()
    const limit = policy({ limit: 2, windowMs: 10_000 })
    const now = 500_000
    subject.consumeSync('a', limit, now)
    const second = subject.consumeSync('a', limit, now + 9_000)
    expect(second.resetAt).toBe(now + 10_000)
  })
})

describe('isolation', () => {
  it('does not let one key spend another key budget', async () => {
    const subject = store()
    const limit = policy({ limit: 1 })
    expect((await subject.consume('a', limit)).allowed).toBe(true)
    expect((await subject.consume('a', limit)).allowed).toBe(false)
    expect((await subject.consume('b', limit)).allowed).toBe(true)
  })

  it('does not let one policy spend another policy budget for the same key', async () => {
    const subject = store()
    const first = policy({ name: 'first', limit: 1 })
    const second = policy({ name: 'second', limit: 1 })
    expect((await subject.consume('a', first)).allowed).toBe(true)
    expect((await subject.consume('a', first)).allowed).toBe(false)
    expect((await subject.consume('a', second)).allowed).toBe(true)
  })
})

describe('expiration', () => {
  it('grants a fresh budget once the window lapses', () => {
    const subject = store()
    const limit = policy({ limit: 1, windowMs: 10_000 })
    const now = 1_000_000
    expect(subject.consumeSync('a', limit, now).allowed).toBe(true)
    expect(subject.consumeSync('a', limit, now + 5_000).allowed).toBe(false)
    expect(subject.consumeSync('a', limit, now + 10_001).allowed).toBe(true)
  })

  it('reuses a lapsed entry in place instead of growing the map', () => {
    const subject = store()
    const limit = policy({ limit: 1, windowMs: 10_000 })
    const now = 1_000_000
    subject.consumeSync('a', limit, now)
    expect(subject.trackedKeys).toBe(1)
    subject.consumeSync('a', limit, now + 20_000)
    expect(subject.trackedKeys).toBe(1)
  })

  it('drops lapsed windows on an explicit sweep', () => {
    const subject = store()
    const limit = policy({ windowMs: 10_000 })
    const now = 1_000_000
    subject.consumeSync('a', limit, now)
    subject.consumeSync('b', limit, now)
    expect(subject.trackedKeys).toBe(2)
    expect(subject.sweep(now + 1_000)).toBe(0)
    expect(subject.sweep(now + 10_001)).toBe(2)
    expect(subject.trackedKeys).toBe(0)
  })

  it('leaves live windows alone when sweeping', () => {
    const subject = store()
    const now = 1_000_000
    subject.consumeSync('short', policy({ windowMs: 5_000 }), now)
    subject.consumeSync('long', policy({ windowMs: 60_000 }), now)
    expect(subject.sweep(now + 6_000)).toBe(1)
    expect(subject.trackedKeys).toBe(1)
  })
})

describe('memory bound', () => {
  it('enforces the tracked-key cap', () => {
    const subject = store({ maxTrackedKeys: 3 })
    const limit = policy({ limit: 5, windowMs: 60_000 })
    const now = 1_000_000
    for (const key of ['a', 'b', 'c']) subject.consumeSync(key, limit, now)
    expect(subject.trackedKeys).toBe(3)
    subject.consumeSync('d', limit, now)
    expect(subject.trackedKeys).toBe(3)
  })

  it('fails closed when full rather than admitting an untracked caller', () => {
    const subject = store({ maxTrackedKeys: 2 })
    const limit = policy({ limit: 5, windowMs: 60_000 })
    const now = 1_000_000
    subject.consumeSync('a', limit, now)
    subject.consumeSync('b', limit, now)
    const overflow = subject.consumeSync('c', limit, now)
    expect(overflow.allowed).toBe(false)
    expect(overflow.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('reclaims capacity from lapsed windows before refusing', () => {
    const subject = store({ maxTrackedKeys: 2 })
    const shortLived = policy({ limit: 5, windowMs: 5_000 })
    const now = 1_000_000
    subject.consumeSync('a', shortLived, now)
    subject.consumeSync('b', shortLived, now)
    const admitted = subject.consumeSync('c', shortLived, now + 6_000)
    expect(admitted.allowed).toBe(true)
    expect(subject.trackedKeys).toBe(1)
  })

  it('does not hand an exhausted key a fresh budget when the store is flooded', () => {
    // The attack: spend a key's budget, then fill the store with junk hoping the limited entry is
    // evicted to make room. Only lapsed entries are ever reclaimed, so the exhausted key survives.
    const subject = store({ maxTrackedKeys: 3 })
    const limit = policy({ limit: 1, windowMs: 60_000 })
    const now = 1_000_000

    expect(subject.consumeSync('victim', limit, now).allowed).toBe(true)
    expect(subject.consumeSync('victim', limit, now).allowed).toBe(false)

    for (let index = 0; index < 50; index += 1) {
      subject.consumeSync(`flood-${index}`, limit, now)
    }

    expect(subject.consumeSync('victim', limit, now).allowed).toBe(false)
    expect(subject.trackedKeys).toBeLessThanOrEqual(3)
  })

  it('still refuses a flooded-out key after the flood lapses but the victim window has not', () => {
    const subject = store({ maxTrackedKeys: 2 })
    const victim = policy({ name: 'victim', limit: 1, windowMs: 60_000 })
    const flood = policy({ name: 'flood', limit: 1, windowMs: 1_000 })
    const now = 1_000_000
    subject.consumeSync('victim', victim, now)
    subject.consumeSync('noise', flood, now)
    expect(subject.consumeSync('victim', victim, now + 2_000).allowed).toBe(false)
  })
})

describe('concurrency', () => {
  it('cannot exceed the budget under overlapping consumes', async () => {
    const subject = store()
    const limit = policy({ limit: 5, windowMs: 60_000 })
    const outcomes = await Promise.all(
      Array.from({ length: 50 }, () => subject.consume('a', limit)),
    )
    expect(outcomes.filter((outcome) => outcome.allowed)).toHaveLength(5)
    expect(outcomes.filter((outcome) => !outcome.allowed)).toHaveLength(45)
  })

  it('holds the budget when several keys are hammered together', async () => {
    const subject = store()
    const limit = policy({ limit: 2, windowMs: 60_000 })
    const work = ['a', 'b', 'c'].flatMap((key) =>
      Array.from({ length: 20 }, () => subject.consume(key, limit).then((d) => ({ key, d }))))
    const outcomes = await Promise.all(work)
    for (const key of ['a', 'b', 'c']) {
      const allowed = outcomes.filter((outcome) => outcome.key === key && outcome.d.allowed)
      expect(allowed).toHaveLength(2)
    }
  })
})

describe('lifecycle', () => {
  it('does not keep the process alive with its sweep timer', () => {
    const subject = new InMemoryRateLimitStore({ sweepIntervalMs: 1_000 })
    expect(subject.sweepTimerHoldsProcessOpen()).toBe(false)
    subject.stopSweep()
    expect(subject.sweepTimerHoldsProcessOpen()).toBeNull()
  })

  it('runs the periodic sweep on its interval', async () => {
    const subject = new InMemoryRateLimitStore({ sweepIntervalMs: 5 })
    subject.consumeSync('a', policy({ windowMs: 1 }), Date.now() - 1_000)
    expect(subject.trackedKeys).toBe(1)
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(subject.trackedKeys).toBe(0)
    subject.stopSweep()
  })

  it('reports itself as non-distributed', () => {
    expect(store().isDistributed).toBe(false)
  })

  it('clears all state', async () => {
    const subject = store()
    await subject.consume('a', policy())
    await subject.clear()
    expect(subject.trackedKeys).toBe(0)
  })
})
