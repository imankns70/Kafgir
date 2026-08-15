import { z } from 'zod'

export enum SupportConversationSubject {
  OrderFollowUp = 1,
  Payment = 2,
  Delivery = 3,
  FoodQuality = 4,
  SuggestionComplaint = 5,
  Other = 6,
}

export enum SupportConversationStatus {
  AwaitingAdmin = 1,
  AwaitingCustomer = 2,
  Closed = 3,
}

export enum SupportSenderType {
  Customer = 1,
  Admin = 2,
}

export enum OrderReviewHandlingStatus {
  New = 1,
  Seen = 2,
  Resolved = 3,
}

export const supportConversationStatusSchema = z.nativeEnum(SupportConversationStatus)
export const orderReviewHandlingStatusSchema = z.nativeEnum(OrderReviewHandlingStatus)

export const supportMessageWriteSchema = z.object({
  message: z.string().trim()
    .min(2, 'متن پیام باید حداقل ۲ نویسه باشد.')
    .max(2000, 'متن پیام نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.'),
})

export const customerSupportConversationCreateSchema = supportMessageWriteSchema.extend({
  subject: z.nativeEnum(SupportConversationSubject),
  orderId: z.number().int().positive().nullable().optional(),
})

export const supportConversationCloseSchema = z.object({ closed: z.boolean() })

export const supportMessageSchema = z.object({
  id: z.number().int().positive(),
  senderType: z.nativeEnum(SupportSenderType),
  senderName: z.string(),
  message: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})

export const supportConversationSummarySchema = z.object({
  id: z.number().int().positive(),
  subject: z.nativeEnum(SupportConversationSubject),
  status: supportConversationStatusSchema,
  orderId: z.number().int().positive().nullable(),
  orderNumber: z.string().nullable(),
  reviewId: z.number().int().positive().nullable(),
  lastMessage: z.string(),
  lastMessageAt: z.string(),
  unreadCount: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export const customerSupportConversationSchema = supportConversationSummarySchema.extend({
  messages: z.array(supportMessageSchema),
})

export const adminSupportConversationSummarySchema = supportConversationSummarySchema.extend({
  customerProfileId: z.number().int().positive(),
  customerName: z.string(),
  customerPhoneNumber: z.string(),
})

export const adminSupportConversationSchema = adminSupportConversationSummarySchema.extend({
  messages: z.array(supportMessageSchema),
})

export const adminOrderReviewSchema = z.object({
  id: z.number().int().positive(),
  orderId: z.number().int().positive(),
  orderNumber: z.string(),
  customerProfileId: z.number().int().positive(),
  customerName: z.string(),
  customerPhoneNumber: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  handlingStatus: orderReviewHandlingStatusSchema,
  conversationId: z.number().int().positive().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export type SupportMessageWriteRequest = z.infer<typeof supportMessageWriteSchema>
export type CustomerSupportConversationCreateRequest = z.infer<typeof customerSupportConversationCreateSchema>
export type SupportConversationCloseRequest = z.infer<typeof supportConversationCloseSchema>
export type SupportMessageDto = z.infer<typeof supportMessageSchema>
export type SupportConversationSummaryDto = z.infer<typeof supportConversationSummarySchema>
export type CustomerSupportConversationDto = z.infer<typeof customerSupportConversationSchema>
export type AdminSupportConversationSummaryDto = z.infer<typeof adminSupportConversationSummarySchema>
export type AdminSupportConversationDto = z.infer<typeof adminSupportConversationSchema>
export type AdminOrderReviewDto = z.infer<typeof adminOrderReviewSchema>
