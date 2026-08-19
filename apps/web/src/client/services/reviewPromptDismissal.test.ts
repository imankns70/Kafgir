import { describe, expect, it } from 'vitest'
import { isOrderDismissed, readDismissedOrders, rememberDismissedOrder } from './reviewPromptDismissal'

/** A stand-in for sessionStorage, so the suppression rule can be tested without a DOM. */
const fakeStorage = (initial: string | null = null) => {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    get raw() { return value },
  }
}

describe('review prompt dismissal', () => {
  it('treats an order as not dismissed until it is', () => {
    const storage = fakeStorage()
    expect(isOrderDismissed(42, storage)).toBe(false)
    rememberDismissedOrder(42, storage)
    expect(isOrderDismissed(42, storage)).toBe(true)
  })

  it('suppresses only the dismissed order, not every prompt', () => {
    // «بعداً» on one order must not silence the rating request for a different delivery.
    const storage = fakeStorage()
    rememberDismissedOrder(42, storage)
    expect(isOrderDismissed(7, storage)).toBe(false)
  })

  it('keeps earlier dismissals when another order is dismissed', () => {
    const storage = fakeStorage()
    rememberDismissedOrder(1, storage)
    rememberDismissedOrder(2, storage)
    expect(readDismissedOrders(storage)).toEqual([1, 2])
  })

  it('does not grow on repeated dismissals of the same order', () => {
    const storage = fakeStorage()
    rememberDismissedOrder(5, storage)
    rememberDismissedOrder(5, storage)
    expect(readDismissedOrders(storage)).toEqual([5])
  })

  it('asks again rather than throwing when storage is unavailable', () => {
    // Private browsing and some Telegram WebViews reject storage access outright.
    expect(isOrderDismissed(1, null)).toBe(false)
    expect(() => rememberDismissedOrder(1, null)).not.toThrow()
  })

  it('recovers from a corrupt stored value instead of losing the prompt', () => {
    expect(readDismissedOrders(fakeStorage('not json'))).toEqual([])
    expect(readDismissedOrders(fakeStorage('{"nope":true}'))).toEqual([])
    expect(readDismissedOrders(fakeStorage('[1,"x",2]'))).toEqual([1, 2])
  })
})
