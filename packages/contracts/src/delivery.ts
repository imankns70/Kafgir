import { z } from 'zod'

/**
 * Delivery windows. `startTime`/`endTime` cross the API as `HH:MM` strings because that is what both
 * UIs render and what PostgreSQL `time` values narrow to; they are never Jalali-formatted text, and
 * the Persian presentation («۱۲:۰۰ تا ۱۴:۰۰») is built in the client from these values.
 */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'زمان باید به شکل HH:MM باشد.')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'تاریخ باید به شکل YYYY-MM-DD باشد.')

/** Why a window cannot be chosen. The customer sees Persian text built from this, not a count. */
export enum DeliverySlotUnavailableReason {
  Inactive = 1,
  DisabledForDate = 2,
  CutoffPassed = 3,
  CapacityFull = 4,
}

/** What checkout renders. Deliberately carries no counts — remaining capacity is not customer data. */
export const availableDeliverySlotSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  startTime: timeOfDay,
  endTime: timeOfDay,
  isAvailable: z.boolean(),
  unavailableReason: z.nativeEnum(DeliverySlotUnavailableReason).nullable(),
})

export const deliverySlotOptionsSchema = z.object({
  deliveryDate: isoDate,
  slots: z.array(availableDeliverySlotSchema),
})

/** Master record, Admin only. */
export const adminDeliveryTimeSlotSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  startTime: timeOfDay,
  endTime: timeOfDay,
  sortOrder: z.number().int(),
  orderCutoffMinutesBeforeStart: z.number().int().nonnegative(),
  isActive: z.boolean(),
})

export const deliveryTimeSlotWriteSchema = z.object({
  title: z.string().trim().min(1).max(100),
  startTime: timeOfDay,
  endTime: timeOfDay,
  sortOrder: z.number().int().min(0).max(1000).default(0),
  orderCutoffMinutesBeforeStart: z.number().int().min(0).max(1440).default(60),
  isActive: z.boolean().default(true),
}).refine((value) => value.startTime < value.endTime, {
  message: 'ساعت پایان باید بعد از ساعت شروع باشد.',
  path: ['endTime'],
})

/** One day's effective picture for Admin: master values plus any override, plus the live usage count. */
export const adminDeliveryDaySlotSchema = z.object({
  slotId: z.number().int().positive(),
  title: z.string(),
  startTime: timeOfDay,
  endTime: timeOfDay,
  sortOrder: z.number().int(),
  isActiveGlobally: z.boolean(),
  hasOverride: z.boolean(),
  /** The configured switch the operator toggles: master flag, or the override when one exists. */
  isAvailable: z.boolean(),
  /**
   * Why a customer cannot currently pick this window, evaluated with the same rules the customer
   * query uses. Null means genuinely selectable. Without this the Admin day view showed «فعال» for
   * windows whose cutoff had passed or whose capacity was full.
   */
  unavailableReason: z.nativeEnum(DeliverySlotUnavailableReason).nullable(),
  capacityOrders: z.number().int().nonnegative().nullable(),
  usedOrders: z.number().int().nonnegative(),
})

export const adminDeliveryDaySchema = z.object({
  deliveryDate: isoDate,
  slots: z.array(adminDeliveryDaySlotSchema),
})

export const deliveryDayOverrideWriteSchema = z.object({
  deliveryDate: isoDate,
  deliveryTimeSlotId: z.number().int().positive(),
  isAvailable: z.boolean(),
  capacityOrders: z.number().int().min(0).max(100000).nullable(),
})

export type AvailableDeliverySlotDto = z.infer<typeof availableDeliverySlotSchema>
export type DeliverySlotOptionsDto = z.infer<typeof deliverySlotOptionsSchema>
export type AdminDeliveryTimeSlotDto = z.infer<typeof adminDeliveryTimeSlotSchema>
export type DeliveryTimeSlotWriteRequest = z.infer<typeof deliveryTimeSlotWriteSchema>
export type AdminDeliveryDaySlotDto = z.infer<typeof adminDeliveryDaySlotSchema>
export type AdminDeliveryDayDto = z.infer<typeof adminDeliveryDaySchema>
export type DeliveryDayOverrideRequest = z.infer<typeof deliveryDayOverrideWriteSchema>

/**
 * The effective customer delivery price for one delivery date, per delivery method.
 *
 * Checkout renders the fee from this before the order is submitted, but the server recalculates it
 * during order creation — this endpoint is display only and is never trusted as an input.
 *
 * `customerDeliveryFee` is null exactly when a courier method has no active courier configuration
 * for that date. Null means "not priced yet", never "free": checkout must block rather than quietly
 * charging zero.
 */
export const deliveryMethodPricingSchema = z.object({
  method: z.number().int().positive(),
  requiresCourier: z.boolean(),
  customerDeliveryFee: z.number().nonnegative().nullable(),
  /** Persian explanation to show when the method cannot be used for this date. */
  unavailableMessage: z.string().nullable(),
})

export const deliveryPricingSchema = z.object({
  deliveryDate: isoDate,
  methods: z.array(deliveryMethodPricingSchema),
})

export type DeliveryMethodPricingDto = z.infer<typeof deliveryMethodPricingSchema>
export type DeliveryPricingDto = z.infer<typeof deliveryPricingSchema>
