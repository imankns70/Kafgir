/**
 * Remembers which delivered orders the customer pushed away with «بعداً».
 *
 * Session-scoped on purpose. Dismissing means "not now", not "never": the order stays eligible
 * server-side and the prompt returns on a later visit. What this prevents is the prompt reopening
 * on the next render or every navigation within the same visit, which is what turns a reasonable
 * request into nagging.
 *
 * Kept apart from the component so the suppression rule can be tested without a DOM, and so a
 * blocked or full sessionStorage degrades to "ask again" rather than throwing during render.
 */

const storageKey = 'kafgir.review.dismissed'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

const defaultStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readDismissedOrders(storage: Storage | null = defaultStorage()): number[] {
  if (!storage) return []
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isSafeInteger(id)) : []
  } catch {
    // Corrupt or unreadable value: treat as nothing dismissed rather than losing the prompt.
    return []
  }
}

export function rememberDismissedOrder(orderId: number, storage: Storage | null = defaultStorage()) {
  if (!storage) return
  try {
    storage.setItem(storageKey, JSON.stringify([...new Set([...readDismissedOrders(storage), orderId])]))
  } catch {
    // Ignore: the prompt reappearing is a smaller failure than crashing the app.
  }
}

export function isOrderDismissed(orderId: number, storage: Storage | null = defaultStorage()): boolean {
  return readDismissedOrders(storage).includes(orderId)
}
