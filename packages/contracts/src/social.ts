import { z } from 'zod'

export const socialPlatforms = ['Telegram', 'Bale', 'Eitaa'] as const
export const socialPlatformSchema = z.enum(socialPlatforms)
export type SocialPlatform = z.infer<typeof socialPlatformSchema>

export const socialTemplateTypes = [
  'DailyMenu',
  'FoodPromotion',
  'Discount',
  'LimitedAvailability',
  'Custom',
] as const
export const socialTemplateTypeSchema = z.enum(socialTemplateTypes)
export type SocialPostTemplateType = z.infer<typeof socialTemplateTypeSchema>

export const socialExecutionModes = ['Manual', 'Suggestion', 'AutoPublish'] as const
export const socialExecutionModeSchema = z.enum(socialExecutionModes)
export type SocialExecutionMode = z.infer<typeof socialExecutionModeSchema>

export const socialTriggerTypes = ['DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability'] as const
export const socialTriggerTypeSchema = z.enum(socialTriggerTypes)
export type SocialTriggerType = z.infer<typeof socialTriggerTypeSchema>

export const socialTargetStatuses = ['Pending', 'Publishing', 'Published', 'Failed', 'Unknown'] as const
export const socialTargetStatusSchema = z.enum(socialTargetStatuses)
export type SocialTargetStatus = z.infer<typeof socialTargetStatusSchema>

export const socialSuggestionStatuses = ['Pending', 'Published', 'Dismissed', 'Expired'] as const
export const socialSuggestionStatusSchema = z.enum(socialSuggestionStatuses)
export type SocialSuggestionStatus = z.infer<typeof socialSuggestionStatusSchema>

const optionalUrl = z.string().trim().url('آدرس واردشده معتبر نیست.').max(2000).nullable().optional()

export const socialChannelWriteSchema = z.object({
  platform: socialPlatformSchema,
  title: z.string().trim().min(2, 'عنوان کانال الزامی است.').max(150),
  externalChannelId: z.string().trim().min(1, 'شناسه کانال الزامی است.').max(200),
  username: z.string().trim().max(150).nullable().optional(),
  credential: z.string().trim().min(8, 'توکن واردشده معتبر نیست.').max(1000).optional(),
  isActive: z.boolean(),
})
export type SocialChannelWriteRequest = z.infer<typeof socialChannelWriteSchema>

export interface SocialChannelDto {
  id: number
  platform: SocialPlatform
  title: string
  externalChannelId: string
  username: string | null
  isActive: boolean
  credentialConfigured: boolean
  connectionStatus: 'Unknown' | 'Connected' | 'Failed'
  lastSuccessfulPublicationAt: string | null
  lastPublicationError: string | null
  createdAt: string
  updatedAt: string
}

export const socialTemplateWriteSchema = z.object({
  id: z.number().int().positive().optional(),
  templateType: socialTemplateTypeSchema,
  title: z.string().trim().min(2).max(150),
  pattern: z.string().trim().min(1).max(8000)
    .refine((value) => !/\{\{\s*(remainingCapacity|initialCapacity|soldQuantity|remainingPercentage)\s*\}\}/iu.test(value),
      'استفاده از اطلاعات عددی ظرفیت در قالب عمومی مجاز نیست.'),
  isActive: z.boolean(),
})
export type SocialTemplateWriteRequest = z.infer<typeof socialTemplateWriteSchema>

export interface SocialTemplateDto extends SocialTemplateWriteRequest {
  id: number
  updatedAt: string
}

export const socialDraftRequestSchema = z.object({
  templateType: socialTemplateTypeSchema,
  sourceId: z.number().int().positive().nullable().optional(),
  menuDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable().optional(),
  customText: z.string().trim().max(8000).nullable().optional(),
  mediaUrl: optionalUrl,
  destinationUrl: optionalUrl,
})
export type SocialDraftRequest = z.infer<typeof socialDraftRequestSchema>

export interface SocialDraftDto {
  templateType: SocialPostTemplateType
  title: string
  sourceType: string | null
  sourceId: number | null
  defaultText: string
  mediaUrl: string | null
  destinationUrl: string | null
  availabilityState?: 'Limited'
}

export const socialPostTargetWriteSchema = z.object({
  channelId: z.number().int().positive(),
  textOverride: z.string().trim().max(8000).nullable().optional(),
  mediaOverride: optionalUrl,
  destinationUrlOverride: optionalUrl,
})
export const socialPostWriteSchema = z.object({
  templateType: socialTemplateTypeSchema,
  title: z.string().trim().max(200).nullable().optional(),
  sourceType: z.string().trim().max(50).nullable().optional(),
  sourceId: z.number().int().positive().nullable().optional(),
  defaultText: z.string().trim().min(1, 'متن انتشار الزامی است.').max(8000),
  mediaUrl: optionalUrl,
  destinationUrl: optionalUrl,
  targets: z.array(socialPostTargetWriteSchema).min(1, 'حداقل یک کانال را انتخاب کنید.')
    .refine((items) => new Set(items.map((item) => item.channelId)).size === items.length,
      'کانال تکراری مجاز نیست.'),
  origin: z.enum(['Manual', 'Suggestion', 'Automation']).default('Manual'),
  suggestionId: z.number().int().positive().nullable().optional(),
})
export type SocialPostWriteRequest = z.infer<typeof socialPostWriteSchema>

export interface SocialPreviewDto {
  platform: SocialPlatform
  channelId: number
  channelTitle: string
  text: string
  mediaUrl: string | null
  destinationUrl: string | null
  actionStyle: 'InlineButton' | 'PlainLink'
}

export interface SocialPostTargetDto {
  id: number
  channelId: number
  channelTitle: string
  platform: SocialPlatform
  status: SocialTargetStatus
  externalMessageId: string | null
  publishedAt: string | null
  lastError: string | null
  retryCount: number
}

export interface SocialPostDto {
  id: number
  templateType: SocialPostTemplateType
  title: string | null
  sourceType: string | null
  sourceId: number | null
  defaultText: string
  mediaUrl: string | null
  destinationUrl: string | null
  status: 'Draft' | 'Publishing' | 'Published' | 'PartiallyFailed' | 'Failed'
  origin: 'Manual' | 'Suggestion' | 'Automation'
  createdByName: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  targets: SocialPostTargetDto[]
}

export const socialRuleWriteSchema = z.object({
  title: z.string().trim().min(2).max(150),
  templateType: socialTemplateTypeSchema.exclude(['Custom']),
  triggerType: socialTriggerTypeSchema,
  isEnabled: z.boolean(),
  executionMode: socialExecutionModeSchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable().optional(),
  thresholdPercentage: z.number().int().min(1).max(99).nullable().optional(),
  cooldownMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  maxExecutionsPerDay: z.number().int().min(1).max(50).nullable().optional(),
  maxExecutionsPerFoodPerDay: z.number().int().min(1).max(20).nullable().optional(),
  priority: z.number().int().min(1).max(1000),
  targetChannelIds: z.array(z.number().int().positive()),
}).superRefine((value, context) => {
  if (value.triggerType === 'LimitedAvailability' && value.thresholdPercentage == null) {
    context.addIssue({ code: 'custom', path: ['thresholdPercentage'], message: 'آستانه ظرفیت الزامی است.' })
  }
})
export type SocialRuleWriteRequest = z.infer<typeof socialRuleWriteSchema>

export interface SocialRuleDto extends SocialRuleWriteRequest {
  id: number
  lastEvaluatedAt: string | null
  createdAt: string
  updatedAt: string
}

export const socialSettingsWriteSchema = z.object({
  minimumIntervalMinutes: z.number().int().min(0).max(1440),
  maximumPostsPerDay: z.number().int().min(1).max(100),
  maximumFoodPromotionPerFoodPerDay: z.number().int().min(1).max(20),
  maximumLimitedAvailabilityPerFoodPerDay: z.number().int().min(1).max(20),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u).nullable(),
  defaultExecutionMode: socialExecutionModeSchema,
  defaultTargetChannelIds: z.array(z.number().int().positive()),
})
export type SocialSettingsWriteRequest = z.infer<typeof socialSettingsWriteSchema>
export interface SocialSettingsDto extends SocialSettingsWriteRequest { id: number; updatedAt: string }

export interface SocialSuggestionDto {
  id: number
  ruleId: number
  ruleTitle: string
  templateType: SocialPostTemplateType
  sourceType: string
  sourceId: number | null
  sourceTitle: string | null
  logicalDate: string
  status: SocialSuggestionStatus
  reason: string
  draft: SocialDraftDto
  createdAt: string
  dismissedAt: string | null
}

export interface SocialDashboardDto {
  suggestionsToday: number
  publishedToday: number
  pendingTargets: number
  failedTargets: number
  activeChannels: number
  autoPublishRequiresRunningApp: true
  timeline: Array<{
    id: number
    title: string
    platform: SocialPlatform | null
    status: string
    occurredAt: string
  }>
}

export const socialHistoryQuerySchema = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  platform: socialPlatformSchema.nullable().optional(),
  channelId: z.number().int().positive().nullable().optional(),
  templateType: socialTemplateTypeSchema.nullable().optional(),
  status: socialTargetStatusSchema.nullable().optional(),
  source: z.string().trim().max(150).nullable().optional(),
  origin: z.enum(['Manual', 'Suggestion', 'Automation']).nullable().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
})
export type SocialHistoryQuery = z.infer<typeof socialHistoryQuerySchema>
export interface SocialHistoryPageDto {
  items: SocialPostDto[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface SocialPublishResultDto {
  postId: number
  targets: SocialPostTargetDto[]
}

export interface SocialAutomationEvaluationDto {
  createdSuggestions: number
  autoPublishPostIds: number[]
  evaluatedAt: string
}
