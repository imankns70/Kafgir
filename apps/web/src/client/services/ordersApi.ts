import type { CreateOrderRequest, OrderDto } from '../types'
import { apiPost } from './apiClient'

export const createOrder = (request: CreateOrderRequest) => apiPost<OrderDto>('/api/orders', request)
