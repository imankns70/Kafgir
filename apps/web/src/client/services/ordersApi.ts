import type { CreateOrderRequest, OrderDto, PublicOrderOptionsDto } from '../types'
import { apiGet, apiPost } from './apiClient'

export const getOrderOptions = () => apiGet<PublicOrderOptionsDto>('/api/order-options')

export const createOrder = async (request: CreateOrderRequest) => {
  const order = await apiPost<OrderDto>('/api/orders', request)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('kafgir:order-changed'))
  return order
}
