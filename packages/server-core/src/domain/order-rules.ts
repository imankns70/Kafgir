import { OrderStatus } from '@kafgir/contracts'

export function normalizePhone(value: string): string {
  const normalized = value.trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  return [...normalized].filter((character) => /\d|\+/.test(character)).join('')
}

export function optionalText(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function isAllowedOrderTransition(current: OrderStatus, next: OrderStatus): boolean {
  return (
    (current === OrderStatus.PendingConfirmation && [OrderStatus.Confirmed, OrderStatus.Cancelled].includes(next)) ||
    (current === OrderStatus.Confirmed && [OrderStatus.Preparing, OrderStatus.Delivered, OrderStatus.Cancelled].includes(next)) ||
    (current === OrderStatus.Preparing && [OrderStatus.Ready, OrderStatus.Cancelled].includes(next)) ||
    (current === OrderStatus.Ready && [OrderStatus.Delivered, OrderStatus.Cancelled].includes(next))
  )
}

export function remainingPortions(capacity: number, sold: number): number {
  return capacity - sold
}
