import type { CartItem } from '../types'

export const cartStorageKey = 'kafgir.cart'

export function loadStoredCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CartItem => {
      if (typeof item !== 'object' || item === null) return false
      const candidate = item as Partial<CartItem>
      return typeof candidate.dailyMenuItemId === 'number'
        && typeof candidate.foodName === 'string'
        && typeof candidate.unitPrice === 'number'
        && typeof candidate.quantity === 'number'
        && candidate.quantity > 0
        && typeof candidate.remainingPortions === 'number'
    })
  } catch {
    return []
  }
}

export function saveStoredCart(items: CartItem[]) {
  localStorage.setItem(cartStorageKey, JSON.stringify(items))
}

export function addStoredCartItem(item: CartItem) {
  const current = loadStoredCart()
  const existing = current.find((value) => value.dailyMenuItemId === item.dailyMenuItemId)
  const next = existing
    ? current.map((value) => value.dailyMenuItemId === item.dailyMenuItemId
      ? {
          ...value,
          foodName: item.foodName,
          unitPrice: item.unitPrice,
          remainingPortions: item.remainingPortions,
          quantity: Math.min(value.quantity + item.quantity, item.remainingPortions),
        }
      : value)
    : [...current, { ...item, quantity: Math.min(item.quantity, item.remainingPortions) }]
  saveStoredCart(next)
  return next
}

export function setStoredCartItemQuantity(id: number, quantity: number) {
  const next = loadStoredCart()
    .map((item) => item.dailyMenuItemId === id
      ? { ...item, quantity: Math.min(quantity, item.remainingPortions) }
      : item)
    .filter((item) => item.quantity > 0)
  saveStoredCart(next)
  return next
}
