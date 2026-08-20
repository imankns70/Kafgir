import { z } from 'zod'
import { DeliveryMethod, PaymentMethod } from './order-enums.js'

const commonMethodSetting = {
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isCustomerEnabled: z.boolean(),
  isManualEnabled: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
}

export const paymentMethodSettingSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  ...commonMethodSetting,
})

export const paymentMethodSettingWriteSchema = paymentMethodSettingSchema.omit({ method: true })

export const deliveryMethodSettingSchema = z.object({
  method: z.nativeEnum(DeliveryMethod),
  ...commonMethodSetting,
  /**
   * The fee for methods that do **not** need a courier — in practice تحویل حضوری, normally zero.
   * Courier methods ignore this value entirely; see `requiresCourier`.
   */
  deliveryFee: z.number().nonnegative(),
  minimumOrderAmount: z.number().nonnegative(),
  /**
   * Whether this method is dispatched by a courier. Fixed per method by what the code actually does,
   * exactly like the enum itself, so it is read-only configuration rather than an operator field.
   *
   * When true, the customer delivery fee comes from the selected delivery date's courier
   * configuration and `deliveryFee` above is unused. This one rule is what keeps delivery pricing
   * from having two competing sources of truth.
   */
  requiresCourier: z.boolean(),
})

export const deliveryMethodSettingWriteSchema = deliveryMethodSettingSchema.omit({
  method: true,
  requiresCourier: true,
})

export const publicOrderOptionsSchema = z.object({
  paymentMethods: z.array(paymentMethodSettingSchema),
  deliveryMethods: z.array(deliveryMethodSettingSchema),
})

export type PaymentMethodSettingDto = z.infer<typeof paymentMethodSettingSchema>
export type PaymentMethodSettingWriteRequest = z.infer<typeof paymentMethodSettingWriteSchema>
export type DeliveryMethodSettingDto = z.infer<typeof deliveryMethodSettingSchema>
export type DeliveryMethodSettingWriteRequest = z.infer<typeof deliveryMethodSettingWriteSchema>
export type PublicOrderOptionsDto = z.infer<typeof publicOrderOptionsSchema>
