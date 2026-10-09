import { z } from 'zod'
import { DeliveryMethod, OrderStatus, PaymentMethod } from './order-enums.js'

/**
 * The kitchen's day: how much of each dish to cook, how the orders spread over the delivery windows,
 * and one packing card per order. Built from orders whose service date is the chosen day.
 */

const portions = z.number().int().nonnegative()

export const productionDishSchema = z.object({
  foodName: z.string(),
  /** Confirmed, preparing or ready: food that has to come out of the kitchen. */
  toCook: portions,
  /** Of `toCook`, portions sold with the Persian-rice upgrade. */
  withPersianRice: portions,
  /** Still awaiting confirmation; likely but not yet promised. */
  pending: portions,
  delivered: portions,
})

export const productionSlotSchema = z.object({
  key: z.string(),
  title: z.string(),
  orders: portions,
  portions,
})

export const packingLineSchema = z.object({
  foodName: z.string(),
  quantity: portions,
  withPersianRice: z.boolean(),
})

export const packingOrderSchema = z.object({
  id: z.number().int(),
  orderNumber: z.string(),
  status: z.nativeEnum(OrderStatus),
  customerFullName: z.string(),
  customerPhoneNumber: z.string(),
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  address: z.string().nullable(),
  slotKey: z.string(),
  slotTitle: z.string(),
  isExpress: z.boolean(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  totalAmount: z.number(),
  customerNote: z.string().nullable(),
  lines: z.array(packingLineSchema),
})

export const productionSheetSchema = z.object({
  date: z.string(),
  dishes: z.array(productionDishSchema),
  persianRicePortions: portions,
  slots: z.array(productionSlotSchema),
  orders: z.array(packingOrderSchema),
})

export type ProductionSheetDto = z.infer<typeof productionSheetSchema>

/** One dish of the day with what the kitchen counted as left over at closing. */
export const leftoverItemSchema = z.object({
  dailyMenuItemId: z.number().int().positive(),
  foodName: z.string(),
  capacityPortions: portions,
  soldPortions: portions,
  leftoverPortions: portions.nullable(),
  recordedAt: z.string().nullable(),
})

export const leftoverWriteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  items: z.array(z.object({
    dailyMenuItemId: z.number().int().positive(),
    leftoverPortions: portions.max(10_000).nullable(),
  })).max(200),
})

export type LeftoverItemDto = z.infer<typeof leftoverItemSchema>
export type LeftoverWriteRequest = z.infer<typeof leftoverWriteSchema>
export type PackingOrderDto = z.infer<typeof packingOrderSchema>
