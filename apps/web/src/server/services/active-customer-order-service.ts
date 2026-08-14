import { OrderStatus, type CustomerOrderSummaryDto } from '@kafgir/contracts'
import { listCustomerOrderCards } from './customer-order-service'

const activeStatuses = new Set<OrderStatus>([
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
])

/**
 * Returns the customer's in-flight orders, newest first within the active-order group.
 * The regular order-card query already prioritizes active orders, so one bounded page keeps this
 * endpoint lightweight while preserving the same ownership and presentation mapping.
 */
export async function listActiveCustomerOrderCards(userId: number): Promise<CustomerOrderSummaryDto[]> {
  const page = await listCustomerOrderCards(userId, 1, 25)
  return page.items.filter((order) => activeStatuses.has(order.status))
}
