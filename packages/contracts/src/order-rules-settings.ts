import { z } from 'zod'

/**
 * When an order nobody confirmed is cancelled automatically. Zero minutes switches the rule off.
 * An order with money paid or awaiting verification is never auto-cancelled: that needs a person.
 */
export const pendingOrderPolicySchema = z.object({
  autoCancelAfterMinutes: z.number().int().min(0).max(24 * 60),
  /** Also cancel a pending order once its service day has passed, however recent it is. */
  cancelAfterServiceDay: z.boolean(),
})

export const defaultPendingOrderPolicy: PendingOrderPolicy = { autoCancelAfterMinutes: 0, cancelAfterServiceDay: false }

export type PendingOrderPolicy = z.infer<typeof pendingOrderPolicySchema>
