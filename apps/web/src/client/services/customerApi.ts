import type {
  CustomerAddressWriteRequest,
  CustomerOrderDetailDto,
  CustomerOrdersPageDto,
  CustomerProfileDto,
  CustomerProfileLookupRequest,
  CustomerSessionDto,
  OrderReviewDto,
  OrderReviewWriteRequest,
} from '../types'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient'

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

export const loginCustomerWithTelegram = (telegramInitData: string) =>
  apiPost<CustomerSessionDto>('/api/auth/customer/telegram', { telegramInitData })

export const requestCustomerOtp = (phoneNumber: string) =>
  apiPost<{ accepted: boolean }>('/api/auth/customer/otp/request', { phoneNumber })

export const verifyCustomerOtp = (phoneNumber: string, code: string) =>
  apiPost<CustomerSessionDto>('/api/auth/customer/otp/verify', { phoneNumber, code })

export const logoutCustomer = () =>
  apiPost<{ authenticated: boolean }>('/api/auth/customer/logout', {})

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

export const getCustomerOrder = (id: number) =>
  apiGet<CustomerOrderDetailDto>(`/api/customers/me/orders/${id}`)

export const saveCustomerOrderReview = (id: number, value: OrderReviewWriteRequest) =>
  apiPut<OrderReviewDto>(`/api/customers/me/orders/${id}/review`, value)
