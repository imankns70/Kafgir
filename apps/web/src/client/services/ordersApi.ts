import type { CreateOrderRequest, OrderDto } from '../types'
import { apiPost } from './apiClient'

export const createOrder = async (request: CreateOrderRequest) => {
  const order = await apiPost<OrderDto>('/api/orders', request)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('kafgir:order-changed'))
  return order
}
