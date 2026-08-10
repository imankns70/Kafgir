import type { DeliverySlotOptionsDto } from '@kafgir/contracts'
import { apiGet } from './apiClient'

/** Availability is always fetched from the server; the client never decides what is still orderable. */
export async function getDeliverySlots(date?: string): Promise<DeliverySlotOptionsDto> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiGet<DeliverySlotOptionsDto>(`/api/delivery-slots${suffix}`)
}
