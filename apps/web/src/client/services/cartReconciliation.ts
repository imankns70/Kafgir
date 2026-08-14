import type { CartAvailability, CartItem, MenuCartSnapshotDto } from '../types'
import { currentBusinessDate } from './cartStorage'

export type CartMenuSnapshot = MenuCartSnapshotDto | null

export type CartReconciliation = {
  items: CartItem[]
  messages: string[]
}

const availabilityMessage = (
  availability: CartAvailability,
  foodName: string,
  remainingPortions: number,
) => {
  switch (availability) {
    case 'sold-out': return `ظرفیت «${foodName}» تکمیل شده است.`
    case 'unavailable': return `«${foodName}» امروز قابل سفارش نیست.`
    case 'menu-closed': return 'سفارش‌گیری منوی امروز بسته است.'
    case 'not-on-menu': return `«${foodName}» دیگر در منوی امروز نیست.`
    case 'available': return remainingPortions > 0 ? null : `ظرفیت «${foodName}» تکمیل شده است.`
  }
}

export function cartItemIssue(item: CartItem): string | null {
  const availability = item.availability ?? 'available'
  if (availability !== 'available') {
    return item.availabilityMessage ?? availabilityMessage(availability, item.foodName, item.remainingPortions)
  }
  if (item.remainingPortions <= 0) return `ظرفیت «${item.foodName}» تکمیل شده است.`
  if (item.quantity > item.remainingPortions) {
    return `از «${item.foodName}» فقط ${item.remainingPortions} پرس باقی مانده است؛ تعداد را کاهش دهید.`
  }
  return null
}

export function reconcileCart(
  items: CartItem[],
  menu: CartMenuSnapshot,
  businessDate = currentBusinessDate(),
): CartReconciliation {
  const menuItems = new Map(menu?.items.map((item) => [item.id, item]) ?? [])
  const menuItemsByFoodId = new Map(menu?.items.map((item) => [item.foodId, item]) ?? [])
  const menuItemsByFoodName = new Map(menu?.items.map((item) => [item.foodName.trim(), item]) ?? [])
  const messages: string[] = !menu
    ? ['منوی امروز هنوز برای سفارش در دسترس نیست.']
    : menu.isOpen ? [] : ['سفارش‌گیری منوی امروز بسته است.']

  // The upgrade is optional, so it only constrains the lines that actually carry it.
  const rice = menu?.persianRice ?? null

  // Both variants of a dish draw from the same portions, so each line only gets what earlier lines
  // of that dish left behind — otherwise 8 plain + 8 upgraded looks fine until the server refuses it.
  const claimed = new Map<number, number>()

  const nextItems = items.flatMap((cartItem): CartItem[] => {
    // A cart line belongs to exactly one Tehran business day. Never roll yesterday's choice into
    // today's menu just because the same food happens to be offered again.
    if (cartItem.menuDate && cartItem.menuDate !== businessDate) return []

    const exact = menuItems.get(cartItem.dailyMenuItemId)
    // Rows may be recreated by Admin during the same business day. Only dated, same-day carts may
    // heal by stable food id/name. Undated legacy lines must match their exact row or be discarded;
    // otherwise an old cart could be mistaken for today's menu during the one-time migration.
    const canRemapWithinDay = cartItem.menuDate === businessDate
    const latest = exact
      ?? (canRemapWithinDay && cartItem.foodId ? menuItemsByFoodId.get(cartItem.foodId) : undefined)
      ?? (canRemapWithinDay ? menuItemsByFoodName.get(cartItem.foodName.trim()) : undefined)

    // Once today's menu exists, a dish removed from it should disappear from the order draft rather
    // than linger as a dead line. Sold-out/unavailable rows are different: they stay visible so the
    // customer can understand what changed and adjust intentionally.
    if (menu && !latest) return []

    const upgraded = Boolean(cartItem.withPersianRice)
    const latestRice = upgraded ? rice : null
    let availability: CartAvailability = 'available'

    if (!menu) availability = 'not-on-menu'
    else if (!menu.isOpen) availability = 'menu-closed'
    else if (!latest?.isAvailable) availability = 'unavailable'
    else if (latest.remainingPortions <= 0) availability = 'sold-out'
    else if (upgraded && (!latest.allowsPersianRice || !latestRice || !latestRice.isAvailable)) availability = 'unavailable'
    else if (latestRice && latestRice.remainingPortions <= 0) availability = 'sold-out'

    // An upgraded line can only go as far as the tighter of the dish share and the Persian rice.
    const resolvedMenuItemId = latest?.id ?? cartItem.dailyMenuItemId
    const alreadyClaimed = claimed.get(resolvedMenuItemId) ?? 0
    const dishShare = Math.max(0, (latest?.remainingPortions ?? 0) - alreadyClaimed)
    claimed.set(resolvedMenuItemId, alreadyClaimed + cartItem.quantity)
    const resolvedRemaining = Math.min(dishShare, latestRice?.remainingPortions ?? Number.MAX_SAFE_INTEGER)

    const next: CartItem = {
      ...cartItem,
      menuDate: businessDate,
      dailyMenuItemId: resolvedMenuItemId,
      foodId: latest?.foodId ?? cartItem.foodId,
      slug: latest?.slug ?? cartItem.slug,
      foodName: latest?.foodName ?? cartItem.foodName,
      persianRiceTitle: latestRice?.title ?? cartItem.persianRiceTitle,
      persianRicePrice: latestRice?.price ?? cartItem.persianRicePrice ?? 0,
      unitPrice: latest ? latest.price : cartItem.unitPrice,
      originalUnitPrice: latest?.originalPrice ?? null,
      discountPercentage: latest?.originalPrice != null
        ? Math.round((1 - latest.price / latest.originalPrice) * 100)
        : null,
      remainingPortions: resolvedRemaining,
      availability,
      availabilityMessage: !menu
        ? 'منوی امروز هنوز برای سفارش در دسترس نیست.'
        : availabilityMessage(availability, latest?.foodName ?? cartItem.foodName, resolvedRemaining),
    }

    const issue = cartItemIssue(next)
    if (issue) messages.push(issue)
    // Current prices are applied silently. Only actionable availability issues are surfaced.
    return [next]
  })

  return { items: nextItems, messages: [...new Set(messages)] }
}
