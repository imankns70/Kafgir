import { OrderStatus, type CustomerOrderDetailDto } from '@kafgir/contracts'
import { updateOrderStatus } from '@kafgir/server-core'
import { AppError } from '../errors'
import { logger } from '../logging/logger'
import { getCustomerOrderDetail } from './customer-order-service'

/**
 * Lets the owner of a ready order confirm that it has physically reached them.
 * Ownership is checked through getCustomerOrderDetail before the shared status transition writes
 * delivered_at and the order status history. Re-reading after the write also makes a concurrent
 * Admin delivery update harmless and returns the authoritative timestamps to the client.
 */
export async function confirmCustomerOrderDelivered(
  userId: number,
  orderId: number,
): Promise<CustomerOrderDetailDto> {
  const current = await getCustomerOrderDetail(userId, orderId)
  if (current.status === OrderStatus.Delivered) return current
  if (current.status !== OrderStatus.Ready) {
    throw new AppError('تأیید تحویل فقط وقتی سفارش آماده تحویل است امکان‌پذیر است.')
  }

  try {
    await updateOrderStatus(orderId, {
      newStatus: OrderStatus.Delivered,
      statusNote: 'تحویل سفارش توسط مشتری تأیید شد.',
    }, userId)
  } catch (error) {
    // Admin may mark the order delivered at the same moment the customer confirms it.
    const refreshed = await getCustomerOrderDetail(userId, orderId)
    if (refreshed.status === OrderStatus.Delivered) return refreshed
    throw error
  }

  logger.info({ event: 'customer.order.delivery.confirmed', userId, orderId }, 'تحویل سفارش توسط مشتری تأیید شد')
  return getCustomerOrderDetail(userId, orderId)
}
