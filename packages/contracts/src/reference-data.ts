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
  deliveryFee: z.number().nonnegative(),
  minimumOrderAmount: z.number().nonnegative(),
})

export const deliveryMethodSettingWriteSchema = deliveryMethodSettingSchema.omit({ method: true })

export const publicOrderOptionsSchema = z.object({
  paymentMethods: z.array(paymentMethodSettingSchema),
  deliveryMethods: z.array(deliveryMethodSettingSchema),
})

export type PaymentMethodSettingDto = z.infer<typeof paymentMethodSettingSchema>
export type PaymentMethodSettingWriteRequest = z.infer<typeof paymentMethodSettingWriteSchema>
export type DeliveryMethodSettingDto = z.infer<typeof deliveryMethodSettingSchema>
export type DeliveryMethodSettingWriteRequest = z.infer<typeof deliveryMethodSettingWriteSchema>
export type PublicOrderOptionsDto = z.infer<typeof publicOrderOptionsSchema>
