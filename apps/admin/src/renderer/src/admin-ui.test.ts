import { describe, expect, it } from 'vitest'

/**
 * `useAsyncAction` guards against the double-submit that a state-only `busy` flag cannot: React does
 * not apply `setBusy(true)` until the next render, so two clicks in the same tick both see `busy ===
 * false`. On screens that confirm a purchase, transfer money, refund a payment or re-publish to a
 * social channel, that second request is a duplicate record, not a wasted round-trip.
 *
 * The hook needs a renderer to exercise directly, and this workspace has no DOM test environment, so
 * the guard is reproduced here exactly as written and asserted against. If the hook's ref logic
 * changes, this test documents the property that must survive.
 */
function createGuard() {
  let inFlight = false
  let busy = false
  return {
    get busy() { return busy },
    async run(action: () => Promise<unknown>) {
      if (inFlight) return
      inFlight = true
      busy = true
      try {
        await action()
      } finally {
        inFlight = false
        busy = false
      }
    },
  }
}

describe('async action guard', () => {
  it('runs the action once for a single call', async () => {
    const guard = createGuard()
    let calls = 0
    await guard.run(async () => { calls += 1 })
    expect(calls).toBe(1)
  })

  it('drops a second call that lands while the first is still in flight', async () => {
    const guard = createGuard()
    let calls = 0
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })

    const first = guard.run(async () => { calls += 1; await gate })
    // Same tick, before any re-render could have applied a state flag.
    const second = guard.run(async () => { calls += 1 })

    release()
    await Promise.all([first, second])
    expect(calls).toBe(1)
  })

  it('reports busy while the action is pending and clears afterwards', async () => {
    const guard = createGuard()
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })

    const pending = guard.run(async () => { await gate })
    expect(guard.busy).toBe(true)
    release()
    await pending
    expect(guard.busy).toBe(false)
  })

  it('clears the guard after a rejection so the action can be retried', async () => {
    const guard = createGuard()
    let calls = 0
    await expect(guard.run(async () => { calls += 1; throw new Error('network') })).rejects.toThrow('network')
    expect(guard.busy).toBe(false)

    await guard.run(async () => { calls += 1 })
    expect(calls).toBe(2)
  })

  it('allows a fresh call once the previous one settles', async () => {
    const guard = createGuard()
    let calls = 0
    await guard.run(async () => { calls += 1 })
    await guard.run(async () => { calls += 1 })
    expect(calls).toBe(2)
  })
})
