import { z } from 'zod'
import { PaymentMethod, PaymentStatus } from './order-enums.js'

/**
 * Order payments.
 *
 * This is deliberately not accounting. It records that a customer paid for an order, by what means,
 * and whether that payment went through — which the customer sees on their own order and the kitchen
 * needs when handing food over. It no longer posts into accounts, balances or a transaction ledger;
 * those existed for a finance system Kafgir does not run.
 */

const id = z.number().int().positive()
const money = z.number().nonnegative().multipleOf(0.01)
const optionalText = z.string().trim().max(2000).nullable().optional()

export const paymentWriteSchema = z.object({
  orderId: id,
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: money.positive(),
  trackingNumber: z.string().trim().max(100).nullable().optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  receiptImageUrl: z.string().trim().max(2000).nullable().optional(),
  description: optionalText,
})

export const paymentStatusWriteSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
  description: optionalText,
})

export const customerPaymentSchema = z.object({
  id,
  orderId: id,
  orderNumber: z.string(),
  customerFullName: z.string(),
  customerPhoneNumber: z.string(),
  orderTotalAmount: money,
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: money,
  status: z.nativeEnum(PaymentStatus),
  trackingNumber: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  receiptImageUrl: z.string().nullable(),
  description: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export type PaymentWriteRequest = z.infer<typeof paymentWriteSchema>
export type PaymentStatusWriteRequest = z.infer<typeof paymentStatusWriteSchema>
export type CustomerPaymentDto = z.infer<typeof customerPaymentSchema>
