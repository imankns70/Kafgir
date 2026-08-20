import type { DeliveryPricingDto, DeliverySlotOptionsDto } from '@kafgir/contracts'
import { apiGet } from './apiClient'

/** Availability is always fetched from the server; the client never decides what is still orderable. */
export async function getDeliverySlots(date?: string): Promise<DeliverySlotOptionsDto> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiGet<DeliverySlotOptionsDto>(`/api/delivery-slots${suffix}`)
}

/**
 * The delivery charge for a given delivery date. Display only — the server recalculates it when the
 * order is created, so this never decides what the customer is actually charged.
 */
export async function getDeliveryPricing(date?: string): Promise<DeliveryPricingDto> {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiGet<DeliveryPricingDto>(`/api/delivery-pricing${suffix}`)
}
