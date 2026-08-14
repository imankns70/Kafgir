import { OrderStatus, type CustomerOrderSummaryDto } from '@kafgir/contracts'
import { listCustomerOrderCards } from './customer-order-service'

const activeStatuses = new Set<OrderStatus>([
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
])

/**
 * Returns the newest in-flight order for the signed-in customer.
 * The regular order-card query already prioritizes active orders, so requesting one row keeps this
 * endpoint small while reusing the existing customer-ownership and presentation mapping.
 */
export async function getActiveCustomerOrderCard(userId: number): Promise<CustomerOrderSummaryDto | null> {
  const page = await listCustomerOrderCards(userId, 1, 1)
  const order = page.items[0] ?? null
  return order && activeStatuses.has(order.status) ? order : null
}
