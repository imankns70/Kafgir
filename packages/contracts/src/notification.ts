import { z } from 'zod'
import { NotificationChannel, NotificationStatus, NotificationType, OrderStatus } from './order-enums.js'

/** Statuses a customer may be told about by SMS. Pending is never sent: the customer just placed it. */
export const smsNotifiableStatuses = [
  OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready, OrderStatus.Delivered, OrderStatus.Cancelled,
] as const

export const customerNotificationSettingsSchema = z.object({
  /** Send status updates by SMS to customers who have no Telegram chat with the bot. */
  smsEnabled: z.boolean(),
  smsStatuses: z.array(z.nativeEnum(OrderStatus))
    .refine((statuses) => statuses.every((status) => (smsNotifiableStatuses as readonly OrderStatus[]).includes(status)),
      'وضعیت انتخاب‌شده برای پیامک مجاز نیست.')
    .transform((statuses) => [...new Set(statuses)]),
})

export const defaultCustomerNotificationSettings: CustomerNotificationSettings = {
  smsEnabled: false,
  smsStatuses: [OrderStatus.Confirmed, OrderStatus.Ready, OrderStatus.Cancelled],
}

export const notificationLogItemSchema = z.object({
  id: z.number().int().positive(),
  channel: z.nativeEnum(NotificationChannel),
  type: z.nativeEnum(NotificationType),
  status: z.nativeEnum(NotificationStatus),
  /** Phone numbers are masked; chat ids are not shown at all. */
  target: z.string(),
  text: z.string(),
  orderNumber: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
})

export type CustomerNotificationSettings = z.infer<typeof customerNotificationSettingsSchema>
export type NotificationLogItemDto = z.infer<typeof notificationLogItemSchema>
