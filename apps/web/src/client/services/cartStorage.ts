import type { CartItem } from '../types'

export const cartStorageKey = 'kafgir.cart'

export function currentBusinessDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const sameLine = (left: Pick<CartItem, 'dailyMenuItemId' | 'withPersianRice'>, right: Pick<CartItem, 'dailyMenuItemId' | 'withPersianRice'>) =>
  left.dailyMenuItemId === right.dailyMenuItemId && Boolean(left.withPersianRice) === Boolean(right.withPersianRice)

export function loadStoredCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    const today = currentBusinessDate()
    return value.filter((item): item is CartItem => {
      if (typeof item !== 'object' || item === null) return false
      const candidate = item as Partial<CartItem>
      return typeof candidate.dailyMenuItemId === 'number'
        && typeof candidate.foodName === 'string'
        && typeof candidate.unitPrice === 'number'
        && typeof candidate.quantity === 'number'
        && candidate.quantity > 0
        && typeof candidate.remainingPortions === 'number'
        // Old carts did not carry a business date. Clearing them once is safer than accidentally
        // turning yesterday's choice into today's order when the same dish appears again.
        && candidate.menuDate === today
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
  const today = currentBusinessDate()
  localStorage.setItem(cartStorageKey, JSON.stringify(items.map((item) => ({
    ...item,
    menuDate: item.menuDate ?? today,
  }))))
}

export function addStoredCartItem(item: CartItem) {
  const today = currentBusinessDate()
  const datedItem: CartItem = { ...item, menuDate: item.menuDate ?? today }
  // Adding a line from a new business day starts a fresh cart. A cart is an order draft for one
  // daily menu, not a reusable grocery list across days.
  const current = loadStoredCart().filter((value) => value.menuDate === datedItem.menuDate)
  const existing = current.find((value) => sameLine(value, datedItem))
  const next = existing
    ? current.map((value) => sameLine(value, datedItem)
      ? {
          ...value,
          foodId: datedItem.foodId ?? value.foodId,
          slug: datedItem.slug ?? value.slug,
          foodName: datedItem.foodName,
          unitPrice: datedItem.unitPrice,
          originalUnitPrice: datedItem.originalUnitPrice ?? null,
          discountPercentage: datedItem.discountPercentage ?? null,
          // Refresh the upgrade too, so a mid-session rice price change is not left stale.
          persianRiceTitle: datedItem.persianRiceTitle ?? null,
          persianRicePrice: datedItem.persianRicePrice ?? 0,
          remainingPortions: datedItem.remainingPortions,
          menuDate: datedItem.menuDate,
          quantity: Math.min(value.quantity + datedItem.quantity, datedItem.remainingPortions),
          availability: 'available' as const,
          availabilityMessage: null,
        }
      : value)
    : [...current, {
        ...datedItem,
        quantity: Math.min(datedItem.quantity, datedItem.remainingPortions),
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
