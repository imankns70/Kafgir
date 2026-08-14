import type {
  CustomerAddressWriteRequest,
  CustomerOrderDetailDto,
  CustomerOrderSummaryDto,
  CustomerOrdersPageDto,
  CustomerProfileDto,
  CustomerProfileLookupRequest,
  CustomerSessionDto,
  OrderReviewDto,
  OrderReviewWriteRequest,
} from '../types'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient'

const emitCustomerAuthChanged = (authenticated: boolean) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('kafgir:customer-auth-changed', { detail: { authenticated } }))
}

const emitOrderChanged = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('kafgir:order-changed'))
}

export async function getMyCustomerProfile(request: CustomerProfileLookupRequest): Promise<CustomerProfileDto | null> {
  try {
    return await apiPost<CustomerProfileDto>('/api/customers/me', request)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const getCustomerSession = () =>
  apiGet<CustomerSessionDto>('/api/auth/customer/session')

export const loginCustomerWithTelegram = async (telegramInitData: string) => {
  const session = await apiPost<CustomerSessionDto>('/api/auth/customer/telegram', { telegramInitData })
  emitCustomerAuthChanged(session.authenticated)
  return session
}

export const requestCustomerOtp = (phoneNumber: string) =>
  apiPost<{ accepted: boolean }>('/api/auth/customer/otp/request', { phoneNumber })

export const verifyCustomerOtp = async (phoneNumber: string, code: string) => {
  const session = await apiPost<CustomerSessionDto>('/api/auth/customer/otp/verify', { phoneNumber, code })
  emitCustomerAuthChanged(session.authenticated)
  return session
}

export const logoutCustomer = async () => {
  const result = await apiPost<{ authenticated: boolean }>('/api/auth/customer/logout', {})
  emitCustomerAuthChanged(false)
  return result
}

export const updateCustomerProfile = (preferredName: string) =>
  apiPatch<CustomerProfileDto>('/api/customers/me', { preferredName })

export const createCustomerAddress = (value: CustomerAddressWriteRequest) =>
  apiPost<CustomerProfileDto>('/api/customers/me/addresses', value)

export const updateCustomerAddress = (id: number, value: CustomerAddressWriteRequest) =>
  apiPut<CustomerProfileDto>(`/api/customers/me/addresses/${id}`, value)

export const deleteCustomerAddress = (id: number) =>
  apiDelete<CustomerProfileDto>(`/api/customers/me/addresses/${id}`, {})

export const getCustomerOrders = (page = 1) =>
  apiGet<CustomerOrdersPageDto>(`/api/customers/me/orders?page=${page}`)

export const getActiveCustomerOrders = () =>
  apiGet<CustomerOrderSummaryDto[]>('/api/customers/me/orders/active')

export const confirmCustomerOrderDelivered = async (id: number) => {
  const order = await apiPost<CustomerOrderDetailDto>(`/api/customers/me/orders/${id}/delivered`, {})
  emitOrderChanged()
  return order
}

export const getCustomerOrder = (id: number) =>
  apiGet<CustomerOrderDetailDto>(`/api/customers/me/orders/${id}`)

export const saveCustomerOrderReview = (id: number, value: OrderReviewWriteRequest) =>
  apiPut<OrderReviewDto>(`/api/customers/me/orders/${id}/review`, value)
