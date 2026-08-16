import { sqlClient } from '../db/client'
import { errorFields, logger } from '../logging/logger'
import { NotificationChannel, NotificationStatus } from '@kafgir/contracts'

type NotificationRow = {
  id: number
  target: string
  text: string
  retryCount: number
}

export async function processNotifications(batchSize = 25): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.')
  const maxRetries = Number(process.env.NOTIFICATION_MAX_RETRIES ?? 5)
  const initialDelay = Number(process.env.NOTIFICATION_INITIAL_RETRY_SECONDS ?? 60)
  const leaseUntil = new Date(Date.now() + 5 * 60 * 1000)
  const claimed = await sqlClient.begin(async (tx) => {
    const rows = await tx<NotificationRow[]>`
      SELECT id, target, text, retry_count AS "retryCount"
      FROM notification_messages
      WHERE channel = ${NotificationChannel.Telegram} AND status = ${NotificationStatus.Pending}
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(batchSize, 100))}
    `
    if (rows.length > 0) {
      await tx`
        UPDATE notification_messages
        SET last_attempt_at = NOW(), next_attempt_at = ${leaseUntil}
        WHERE id IN ${tx(rows.map((row) => row.id))}
      `
    }
    return rows
  })

  for (const message of claimed) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message.target, text: message.text }),
      })
      const body = await response.json() as { ok?: boolean; description?: string }
      if (!response.ok || !body.ok) throw new Error(body.description || `Telegram HTTP ${response.status}`)
      await sqlClient`
        UPDATE notification_messages
        SET status = ${NotificationStatus.Sent}, sent_at = NOW(), last_error = NULL, next_attempt_at = NULL
        WHERE id = ${message.id}
      `
      logger.info({ event: 'notification.sent', notificationId: message.id }, 'اعلان تلگرام ارسال شد')
    } catch (error) {
      logger.error({ event: 'notification.failed', notificationId: message.id,
        retryCount: message.retryCount, ...errorFields(error) }, 'ارسال اعلان تلگرام ناموفق بود')
      const retries = message.retryCount + 1
      const terminal = retries >= maxRetries
      const delaySeconds = initialDelay * (2 ** Math.max(0, retries - 1))
      await sqlClient`
        UPDATE notification_messages
        SET retry_count = ${retries},
            status = ${terminal ? NotificationStatus.Failed : NotificationStatus.Pending},
            last_error = ${String(error).slice(0, 1000)},
            next_attempt_at = ${terminal ? null : new Date(Date.now() + delaySeconds * 1000)}
        WHERE id = ${message.id}
      `
    }
  }
  return claimed.length
}
