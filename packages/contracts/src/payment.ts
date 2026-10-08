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
  /** Part of `amount` handed back; equal to it once the payment is fully refunded. */
  refundedAmount: money.default(0),
  refundReason: z.string().nullable().default(null),
  refundedAt: z.string().nullable().default(null),
  orderStatus: z.number().int().optional(),
})

/** A refund names how much goes back and why; it may be part of the payment. */
export const paymentRefundWriteSchema = z.object({
  amount: money.positive(),
  reason: z.string().trim().min(2).max(500),
})

/** An order that was handed over (or is about to be) without its money having arrived in full. */
export const unpaidOrderSchema = z.object({
  orderId: id,
  orderNumber: z.string(),
  customerFullName: z.string(),
  customerPhoneNumber: z.string(),
  status: z.number().int(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  serviceDate: z.string(),
  totalAmount: money,
  paidAmount: money,
  pendingAmount: money,
  balance: money,
})

/** One day's money by method: what was taken, what was handed back, and the net. */
export const paymentReconciliationSchema = z.object({
  date: z.string(),
  methods: z.array(z.object({
    paymentMethod: z.nativeEnum(PaymentMethod),
    count: z.number().int().nonnegative(),
    received: money,
    refunded: money,
    net: z.number(),
  })),
  totals: z.object({ received: money, refunded: money, net: z.number() }),
  /** Delivered that day and still not fully paid, whatever their method. */
  unpaidDeliveredCount: z.number().int().nonnegative(),
  unpaidDeliveredAmount: money,
})

export type PaymentWriteRequest = z.infer<typeof paymentWriteSchema>
export type PaymentStatusWriteRequest = z.infer<typeof paymentStatusWriteSchema>
export type CustomerPaymentDto = z.infer<typeof customerPaymentSchema>
export type PaymentRefundWriteRequest = z.infer<typeof paymentRefundWriteSchema>
export type UnpaidOrderDto = z.infer<typeof unpaidOrderSchema>
export type PaymentReconciliationDto = z.infer<typeof paymentReconciliationSchema>

/** One line of the change log: an audited action or an order status change, with its operator. */
export const auditLogEntrySchema = z.object({
  key: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.number().int().nullable(),
  details: z.string().nullable(),
  createdAt: z.string(),
  userName: z.string().nullable(),
  orderNumber: z.string().nullable(),
})
export type AuditLogEntryDto = z.infer<typeof auditLogEntrySchema>
