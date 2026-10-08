import {
  NotificationChannel,
  customerNotificationSettingsSchema,
  defaultCustomerNotificationSettings,
  type CustomerNotificationSettings,
  type NotificationLogItemDto,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { logger } from '../logging/logger'

/**
 * How customers hear about their order. Telegram is free and always used when the customer has a
 * chat with the bot; SMS costs money per message, so it is off until the Owner turns it on and then
 * only goes out for the statuses chosen here.
 */

const settingsKey = 'CustomerSmsStatusUpdates'

type Sql = TransactionSql | typeof sqlClient

export async function getCustomerNotificationSettings(sql: Sql = sqlClient): Promise<CustomerNotificationSettings> {
  const rows = await sql<{ value: string }[]>`SELECT value FROM app_settings WHERE key = ${settingsKey} LIMIT 1`
  if (!rows[0]) return defaultCustomerNotificationSettings
  try {
    return customerNotificationSettingsSchema.parse(JSON.parse(rows[0].value))
  } catch {
    // A hand-edited or older value must not stop status changes; fall back to «off».
    return defaultCustomerNotificationSettings
  }
}

export async function saveCustomerNotificationSettings(input: CustomerNotificationSettings, userId: number): Promise<CustomerNotificationSettings> {
  const value = JSON.stringify(customerNotificationSettingsSchema.parse(input))
  await sqlClient.begin(async (tx) => {
    await tx`
      INSERT INTO app_settings (key, value, description)
      VALUES (${settingsKey}, ${value}, 'اطلاع‌رسانی وضعیت سفارش با پیامک برای مشتریان بدون تلگرام')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    await tx`
      INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
      VALUES ('settings.notifications', 'settings', NULL, ${userId}, ${value}, NOW())`
  })
  logger.info({ event: 'settings.notifications', userId }, 'تنظیمات اطلاع‌رسانی ذخیره شد')
  return getCustomerNotificationSettings()
}

/** «09121234567» → «0912***4567». Enough to recognise a customer, not enough to copy the number. */
export const maskPhone = (phone: string) => phone.length >= 8 ? `${phone.slice(0, 4)}***${phone.slice(-4)}` : '***'

export async function listRecentNotifications(limit = 100): Promise<NotificationLogItemDto[]> {
  const rows = await sqlClient<Array<Omit<NotificationLogItemDto, 'createdAt' | 'sentAt'> & { createdAt: Date; sentAt: Date | null }>>`
    SELECT id, channel, type, status, target, text, order_number AS "orderNumber", retry_count AS "retryCount",
           last_error AS "lastError", created_at AS "createdAt", sent_at AS "sentAt"
    FROM notification_messages
    ORDER BY created_at DESC, id DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}`
  return rows.map((row) => ({
    ...row,
    target: row.channel === NotificationChannel.Sms ? maskPhone(row.target) : 'تلگرام',
    createdAt: new Date(row.createdAt).toISOString(),
    sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : null,
  }))
}
