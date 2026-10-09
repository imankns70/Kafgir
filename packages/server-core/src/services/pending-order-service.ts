import {
  OrderStatus,
  PaymentStatus,
  defaultPendingOrderPolicy,
  pendingOrderPolicySchema,
  type PendingOrderPolicy,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { orderServiceDate } from '../db/service-date'
import { logger } from '../logging/logger'
import { businessDate } from '../time'
import { updateOrderStatus } from './order-service'

const settingsKey = 'PendingOrderPolicy'

export async function getPendingOrderPolicy(): Promise<PendingOrderPolicy> {
  const rows = await sqlClient<{ value: string }[]>`SELECT value FROM app_settings WHERE key = ${settingsKey} LIMIT 1`
  if (!rows[0]) return defaultPendingOrderPolicy
  try { return pendingOrderPolicySchema.parse(JSON.parse(rows[0].value)) }
  catch { return defaultPendingOrderPolicy }
}

export async function savePendingOrderPolicy(input: PendingOrderPolicy, userId: number): Promise<PendingOrderPolicy> {
  const value = JSON.stringify(pendingOrderPolicySchema.parse(input))
  await sqlClient.begin(async (tx) => {
    await tx`
      INSERT INTO app_settings (key, value, description)
      VALUES (${settingsKey}, ${value}, 'لغو خودکار سفارش‌های تأییدنشده')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    await tx`
      INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
      VALUES ('settings.pendingOrders', 'settings', NULL, ${userId}, ${value}, NOW())`
  })
  return getPendingOrderPolicy()
}

/**
 * Cancels pending orders the business never answered. Each goes through the ordinary status change,
 * so unpaid payments are closed and the customer hears about it like any other cancellation. Safe to
 * run from several places at once: a second runner finds the order no longer pending and skips it.
 */
export async function cancelStalePendingOrders(now = new Date()): Promise<number> {
  const policy = await getPendingOrderPolicy()
  if (policy.autoCancelAfterMinutes <= 0 && !policy.cancelAfterServiceDay) return 0
  const cutoff = new Date(now.getTime() - policy.autoCancelAfterMinutes * 60_000)
  const today = businessDate(now)
  const stale = await sqlClient<{ id: number; tooOld: boolean }[]>`
    SELECT o.id, (${policy.autoCancelAfterMinutes} > 0 AND o.created_at < ${cutoff}) AS "tooOld"
    FROM orders o
    WHERE o.status = ${OrderStatus.PendingConfirmation}
      AND ((${policy.autoCancelAfterMinutes} > 0 AND o.created_at < ${cutoff})
        OR (${policy.cancelAfterServiceDay} AND ${orderServiceDate('o')} < ${today}::date))
      AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE p.order_id = o.id
          AND p.status IN (${PaymentStatus.Paid}, ${PaymentStatus.AwaitingVerification}))
    ORDER BY o.id
    LIMIT 100`
  let cancelled = 0
  for (const order of stale) {
    try {
      await updateOrderStatus(order.id, {
        newStatus: OrderStatus.Cancelled,
        statusNote: order.tooOld
          ? `لغو خودکار: ${policy.autoCancelAfterMinutes} دقیقه بدون تأیید`
          : 'لغو خودکار: روز سرویس گذشته بود',
      })
      cancelled += 1
    } catch (error) {
      // Someone confirmed it a moment ago; that is the right outcome, not a failure.
      logger.warn({ event: 'order.autoCancel.skipped', orderId: order.id, err: error }, 'لغو خودکار انجام نشد')
    }
  }
  if (cancelled > 0) logger.info({ event: 'order.autoCancel', cancelled }, 'سفارش‌های تأییدنشده لغو شدند')
  return cancelled
}
