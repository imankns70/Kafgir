import type { CartItem } from '../types'

export const cartStorageKey = 'kafgir.cart'
const sameLine = (left: Pick<CartItem, 'dailyMenuItemId' | 'withPersianRice'>, right: Pick<CartItem, 'dailyMenuItemId' | 'withPersianRice'>) =>
  left.dailyMenuItemId === right.dailyMenuItemId && Boolean(left.withPersianRice) === Boolean(right.withPersianRice)

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
    }).map((item) => ({
      ...item,
      availability: ['available', 'sold-out', 'unavailable', 'menu-closed', 'not-on-menu'].includes(item.availability ?? '')
        ? item.availability
        : 'available',
      availabilityMessage: typeof item.availabilityMessage === 'string' ? item.availabilityMessage : null,
    }))
  } catch {
    return []
  }
}

export function saveStoredCart(items: CartItem[]) {
  localStorage.setItem(cartStorageKey, JSON.stringify(items))
}

export function addStoredCartItem(item: CartItem) {
  const current = loadStoredCart()
  const existing = current.find((value) => sameLine(value, item))
  const next = existing
    ? current.map((value) => sameLine(value, item)
      ? {
          ...value,
          foodId: item.foodId ?? value.foodId,
          slug: item.slug ?? value.slug,
          foodName: item.foodName,
          unitPrice: item.unitPrice,
          originalUnitPrice: item.originalUnitPrice ?? null,
          discountPercentage: item.discountPercentage ?? null,
          // Refresh the upgrade too, so a mid-session rice price change is not left stale.
          persianRiceTitle: item.persianRiceTitle ?? null,
          persianRicePrice: item.persianRicePrice ?? 0,
          remainingPortions: item.remainingPortions,
          quantity: Math.min(value.quantity + item.quantity, item.remainingPortions),
          availability: 'available' as const,
          availabilityMessage: null,
        }
      : value)
    : [...current, {
        ...item,
        quantity: Math.min(item.quantity, item.remainingPortions),
        availability: 'available' as const,
        availabilityMessage: null,
      }]
  saveStoredCart(next)
  return next
}

export function setStoredCartItemQuantity(id: number, quantity: number, withPersianRice = false) {
  const next = loadStoredCart()
    .map((item) => item.dailyMenuItemId === id && Boolean(item.withPersianRice) === withPersianRice
      ? {
          ...item,
          quantity: Math.min(quantity, item.remainingPortions),
          availability: item.remainingPortions > 0 ? 'available' as const : item.availability,
          availabilityMessage: item.remainingPortions > 0 ? null : item.availabilityMessage,
        }
      : item)
    .filter((item) => item.quantity > 0)
  saveStoredCart(next)
  return next
}
