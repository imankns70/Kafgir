import {
  socialChannelWriteSchema,
  socialDraftRequestSchema,
  socialHistoryQuerySchema,
  socialPostWriteSchema,
  socialRuleWriteSchema,
  socialSettingsWriteSchema,
  socialTemplateWriteSchema,
  type SocialAutomationEvaluationDto,
  type SocialChannelDto,
  type SocialChannelWriteRequest,
  type SocialDashboardDto,
  type SocialDraftDto,
  type SocialHistoryPageDto,
  type SocialHistoryQuery,
  type SocialPostDto,
  type SocialPostTargetDto,
  type SocialPostTemplateType,
  type SocialPostWriteRequest,
  type SocialPreviewDto,
  type SocialRuleDto,
  type SocialRuleWriteRequest,
  type SocialSettingsDto,
  type SocialSettingsWriteRequest,
  type SocialSuggestionDto,
  type SocialTemplateDto,
  type SocialTemplateWriteRequest,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { businessDate, businessMinutesOfDay } from '../time'
import { formatSocialMoney, renderSocialTemplate } from '../social/template-renderer'
import { isSocialRuleEligible, isWithinSocialTimeWindow, socialTimeMinutes } from '../social/automation-rules'

type DbTimestamp = Date | string
const iso = (value: DbTimestamp) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIso = (value: DbTimestamp | null) => value ? iso(value) : null
const nowSql = () => new Date().toISOString()

const templateTitles: Record<SocialPostTemplateType, string> = {
  DailyMenu: 'منوی امروز',
  FoodPromotion: 'تبلیغ غذا',
  Discount: 'تخفیف',
  LimitedAvailability: 'ظرفیت محدود',
  Custom: 'پیام آزاد',
}

type ChannelRecord = Omit<SocialChannelDto, 'credentialConfigured' | 'createdAt' | 'updatedAt' |
  'lastSuccessfulPublicationAt'> & {
    credentialConfigured: boolean
    createdAt: DbTimestamp
    updatedAt: DbTimestamp
    lastSuccessfulPublicationAt: DbTimestamp | null
  }

const mapChannel = (row: ChannelRecord): SocialChannelDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  lastSuccessfulPublicationAt: nullableIso(row.lastSuccessfulPublicationAt),
})

export async function listSocialChannels(): Promise<SocialChannelDto[]> {
  const rows = await sqlClient<ChannelRecord[]>`
    SELECT id, platform, title, external_channel_id AS "externalChannelId", username,
           is_active AS "isActive", credential_ciphertext IS NOT NULL AS "credentialConfigured",
           connection_status AS "connectionStatus",
           last_successful_publication_at AS "lastSuccessfulPublicationAt",
           last_publication_error AS "lastPublicationError", created_at AS "createdAt",
           updated_at AS "updatedAt"
    FROM social_channels ORDER BY is_active DESC, platform, title
  `
  return rows.map(mapChannel)
}

export async function saveSocialChannel(
  id: number | null,
  input: SocialChannelWriteRequest,
  credentialCiphertext?: string,
): Promise<SocialChannelDto> {
  const value = socialChannelWriteSchema.parse(input)
  if (!id && !credentialCiphertext) throw new AppError('توکن کانال جدید الزامی است.')
  const timestamp = nowSql()
  const rows = id
    ? await sqlClient<{ id: number }[]>`
        UPDATE social_channels
        SET platform = ${value.platform}, title = ${value.title},
            external_channel_id = ${value.externalChannelId}, username = ${value.username ?? null},
            credential_ciphertext = COALESCE(${credentialCiphertext ?? null}, credential_ciphertext),
            is_active = ${value.isActive}, connection_status = 'Unknown',
            last_publication_error = NULL, updated_at = ${timestamp}
        WHERE id = ${id} RETURNING id
      `
    : await sqlClient<{ id: number }[]>`
        INSERT INTO social_channels
          (platform, title, external_channel_id, username, credential_ciphertext, is_active,
           connection_status, created_at, updated_at)
        VALUES (${value.platform}, ${value.title}, ${value.externalChannelId}, ${value.username ?? null},
                ${credentialCiphertext!}, ${value.isActive}, 'Unknown', ${timestamp}, ${timestamp})
        RETURNING id
      `
  if (!rows[0]) throw new NotFoundError('کانال اجتماعی پیدا نشد.')
  return (await listSocialChannels()).find((channel) => channel.id === rows[0]!.id)!
}

export async function getSocialChannelCredentialRecord(id: number) {
  const rows = await sqlClient<Array<{
    id: number
    platform: SocialChannelDto['platform']
    externalChannelId: string
    credentialCiphertext: string | null
    isActive: boolean
  }>>`
    SELECT id, platform, external_channel_id AS "externalChannelId",
           credential_ciphertext AS "credentialCiphertext", is_active AS "isActive"
    FROM social_channels WHERE id = ${id} LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError('کانال اجتماعی پیدا نشد.')
  return rows[0]
}

export async function updateSocialChannelConnection(id: number, connected: boolean, detail: string | null) {
  await sqlClient`
    UPDATE social_channels
    SET connection_status = ${connected ? 'Connected' : 'Failed'},
        last_publication_error = ${connected ? null : detail}, updated_at = ${nowSql()}
    WHERE id = ${id}
  `
}

type TemplateRecord = Omit<SocialTemplateDto, 'updatedAt'> & { updatedAt: DbTimestamp }
export async function listSocialTemplates(): Promise<SocialTemplateDto[]> {
  const rows = await sqlClient<TemplateRecord[]>`
    SELECT id, template_type AS "templateType", title, pattern, is_active AS "isActive",
           updated_at AS "updatedAt"
    FROM social_post_templates ORDER BY id
  `
  return rows.map((row) => ({ ...row, updatedAt: iso(row.updatedAt) }))
}

export async function saveSocialTemplate(value: SocialTemplateWriteRequest): Promise<SocialTemplateDto> {
  const input = socialTemplateWriteSchema.parse(value)
  const timestamp = nowSql()
  const rows = input.id
    ? await sqlClient<{ id: number }[]>`
        UPDATE social_post_templates SET title = ${input.title}, pattern = ${input.pattern},
          is_active = ${input.isActive}, updated_at = ${timestamp}
        WHERE id = ${input.id} RETURNING id
      `
    : await sqlClient<{ id: number }[]>`
        INSERT INTO social_post_templates
          (template_type, title, pattern, is_active, created_at, updated_at)
        VALUES (${input.templateType}, ${input.title}, ${input.pattern}, ${input.isActive}, ${timestamp}, ${timestamp})
        ON CONFLICT (template_type) DO UPDATE SET title = EXCLUDED.title, pattern = EXCLUDED.pattern,
          is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at
        RETURNING id
      `
  return (await listSocialTemplates()).find((template) => template.id === rows[0]!.id)!
}

async function publicOrderUrl() {
  const settings = await sqlClient<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = 'PublicOrderUrl' LIMIT 1
  `
  return settings[0]?.value || process.env.KAFGIR_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'
}

async function activeTemplate(type: SocialPostTemplateType) {
  const rows = await sqlClient<{ pattern: string }[]>`
    SELECT pattern FROM social_post_templates WHERE template_type = ${type} AND is_active = true LIMIT 1
  `
  if (!rows[0]) throw new AppError(`قالب «${templateTitles[type]}» فعال نیست.`)
  return rows[0].pattern
}

type PromotionSource = {
  id: number
  foodId: number
  name: string
  description: string | null
  price: number
  originalPrice: number
  discountPrice: number | null
  mediaUrl: string | null
}

async function promotionSource(sourceId: number) {
  const rows = await sqlClient<PromotionSource[]>`
    SELECT dmi.id, f.id AS "foodId", f.name, f.description,
           COALESCE(dmi.discount_price, dmi.price)::float8 AS price,
           dmi.price::float8 AS "originalPrice", dmi.discount_price::float8 AS "discountPrice",
           COALESCE(fi.image_url, f.image_url) AS "mediaUrl"
    FROM daily_menu_items dmi
    JOIN foods f ON f.id = dmi.food_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM food_images
      WHERE food_id = f.id ORDER BY is_primary DESC, display_order, id LIMIT 1
    ) fi ON true
    WHERE dmi.id = ${sourceId} AND f.is_active = true
    LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError('غذای منوی انتخابی پیدا نشد.')
  return rows[0]
}

export async function generateSocialDraft(raw: unknown): Promise<SocialDraftDto> {
  const request = socialDraftRequestSchema.parse(raw)
  const pattern = await activeTemplate(request.templateType)
  const orderUrl = request.destinationUrl || await publicOrderUrl()
  if (request.templateType === 'Custom') {
    const text = renderSocialTemplate('Custom', pattern, { customText: request.customText ?? '' })
    if (!text) throw new AppError('متن پیام آزاد الزامی است.')
    return {
      templateType: 'Custom', title: 'پیام آزاد', sourceType: 'Manual', sourceId: null,
      defaultText: text, mediaUrl: request.mediaUrl ?? null, destinationUrl: request.destinationUrl ?? null,
    }
  }
  if (request.templateType === 'DailyMenu') {
    const date = request.menuDate || businessDate()
    const menus = await sqlClient<{ id: number; isOpen: boolean }[]>`
      SELECT id, is_open AS "isOpen" FROM daily_menus WHERE menu_date = ${date}::date LIMIT 1
    `
    if (!menus[0]) throw new NotFoundError('منوی این روز پیدا نشد.')
    const items = await sqlClient<Array<{ name: string; price: number }>>`
      SELECT f.name, COALESCE(dmi.discount_price, dmi.price)::float8 AS price
      FROM daily_menu_items dmi JOIN foods f ON f.id = dmi.food_id
      WHERE dmi.daily_menu_id = ${menus[0].id} AND dmi.is_available = true AND f.is_active = true
      ORDER BY dmi.id
    `
    if (items.length === 0) throw new AppError('منوی انتخابی غذای قابل انتشار ندارد.')
    const menuItems = items.map((item) => `🍲 ${item.name} — ${formatSocialMoney(item.price)}`).join('\n')
    return {
      templateType: 'DailyMenu', title: `منوی ${date}`, sourceType: 'DailyMenu', sourceId: menus[0].id,
      defaultText: renderSocialTemplate('DailyMenu', pattern, { menuItems, orderUrl }),
      mediaUrl: request.mediaUrl ?? null, destinationUrl: orderUrl,
    }
  }
  if (!request.sourceId) throw new AppError('انتخاب غذا الزامی است.')
  const source = await promotionSource(request.sourceId)
  if (request.templateType === 'Discount' && source.discountPrice == null) {
    throw new AppError('این غذا تخفیف فعال ندارد.')
  }
  const variables = {
    foodName: source.name,
    description: source.description ?? 'غذای خانگی تازه و خوش‌طعم کفگیر',
    price: formatSocialMoney(source.price),
    originalPrice: formatSocialMoney(source.originalPrice),
    discountPrice: formatSocialMoney(source.discountPrice ?? source.price),
    orderUrl,
  }
  return {
    templateType: request.templateType,
    title: `${templateTitles[request.templateType]} ${source.name}`,
    sourceType: 'DailyMenuItem',
    sourceId: source.id,
    defaultText: renderSocialTemplate(request.templateType, pattern, variables),
    mediaUrl: request.mediaUrl ?? source.mediaUrl,
    destinationUrl: orderUrl,
    ...(request.templateType === 'LimitedAvailability' ? { availabilityState: 'Limited' as const } : {}),
  }
}

export async function previewSocialPost(raw: unknown): Promise<SocialPreviewDto[]> {
  const value = socialPostWriteSchema.parse(raw)
  const channels = await listSocialChannels()
  return value.targets.map((target) => {
    const channel = channels.find((item) => item.id === target.channelId)
    if (!channel?.isActive) throw new AppError('یکی از کانال‌های انتخابی غیرفعال یا حذف شده است.')
    const text = target.textOverride || value.defaultText
    // The renderer is the privacy boundary even for edited drafts and per-platform overrides.
    renderSocialTemplate(value.templateType, text, {})
    return {
      platform: channel.platform,
      channelId: channel.id,
      channelTitle: channel.title,
      text,
      mediaUrl: target.mediaOverride ?? value.mediaUrl ?? null,
      destinationUrl: target.destinationUrlOverride ?? value.destinationUrl ?? null,
      actionStyle: channel.platform === 'Eitaa' ? 'PlainLink' : 'InlineButton',
    }
  })
}

export async function createSocialPost(raw: unknown, userId: number): Promise<SocialPostDto> {
  const value = socialPostWriteSchema.parse(raw)
  await previewSocialPost(value)
  const timestamp = nowSql()
  const id = await sqlClient.begin(async (tx) => {
    const rows = await tx<{ id: number }[]>`
      INSERT INTO social_posts
        (template_type, title, source_type, source_id, default_text, media_url, destination_url,
         status, origin, created_by_user_id, created_at, updated_at)
      VALUES (${value.templateType}, ${value.title ?? null}, ${value.sourceType ?? null},
        ${value.sourceId ?? null}, ${value.defaultText}, ${value.mediaUrl ?? null},
        ${value.destinationUrl ?? null}, 'Draft', ${value.origin}, ${userId}, ${timestamp}, ${timestamp})
      RETURNING id
    `
    const postId = rows[0]!.id
    for (const target of value.targets) {
      await tx`
        INSERT INTO social_post_targets
          (social_post_id, social_channel_id, text_override, media_override,
           destination_url_override, status, idempotency_key, retry_count, created_at, updated_at)
        VALUES (${postId}, ${target.channelId}, ${target.textOverride ?? null},
          ${target.mediaOverride ?? null}, ${target.destinationUrlOverride ?? null}, 'Pending',
          ${crypto.randomUUID()}, 0, ${timestamp}, ${timestamp})
      `
    }
    if (value.suggestionId) {
      await tx`
        UPDATE social_suggestions SET published_post_id = ${postId}, updated_at = ${timestamp}
        WHERE id = ${value.suggestionId} AND status = 'Pending'
      `
    }
    return postId
  })
  return getSocialPost(id)
}

type PostRecord = Omit<SocialPostDto, 'targets' | 'createdAt' | 'updatedAt' | 'publishedAt'> & {
  createdAt: DbTimestamp
  updatedAt: DbTimestamp
  publishedAt: DbTimestamp | null
}
type TargetRecord = Omit<SocialPostTargetDto, 'publishedAt'> & { publishedAt: DbTimestamp | null }

async function targetsForPosts(ids: number[]) {
  if (ids.length === 0) return new Map<number, SocialPostTargetDto[]>()
  const rows = await sqlClient<Array<TargetRecord & { postId: number }>>`
    SELECT spt.id, spt.social_post_id AS "postId", spt.social_channel_id AS "channelId",
           sc.title AS "channelTitle", sc.platform, spt.status,
           spt.external_message_id AS "externalMessageId", spt.published_at AS "publishedAt",
           spt.last_error AS "lastError", spt.retry_count AS "retryCount"
    FROM social_post_targets spt JOIN social_channels sc ON sc.id = spt.social_channel_id
    WHERE spt.social_post_id = ANY(${ids}) ORDER BY spt.id
  `
  const result = new Map<number, SocialPostTargetDto[]>()
  for (const row of rows) {
    const current = result.get(row.postId) ?? []
    current.push({ ...row, publishedAt: nullableIso(row.publishedAt) })
    result.set(row.postId, current)
  }
  return result
}

const mapPost = (row: PostRecord, targets: SocialPostTargetDto[]): SocialPostDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  publishedAt: nullableIso(row.publishedAt),
  targets,
})

export async function getSocialPost(id: number): Promise<SocialPostDto> {
  const rows = await sqlClient<PostRecord[]>`
    SELECT sp.id, sp.template_type AS "templateType", sp.title, sp.source_type AS "sourceType",
           sp.source_id AS "sourceId", sp.default_text AS "defaultText", sp.media_url AS "mediaUrl",
           sp.destination_url AS "destinationUrl", sp.status, sp.origin,
           COALESCE(u.full_name, u.username) AS "createdByName", sp.created_at AS "createdAt",
           sp.updated_at AS "updatedAt", sp.published_at AS "publishedAt"
    FROM social_posts sp JOIN users u ON u.id = sp.created_by_user_id WHERE sp.id = ${id} LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError('انتشار پیدا نشد.')
  const targets = await targetsForPosts([id])
  return mapPost(rows[0], targets.get(id) ?? [])
}

export async function listSocialHistory(raw: unknown): Promise<SocialHistoryPageDto> {
  const query = socialHistoryQuerySchema.parse(raw)
  const offset = (query.page - 1) * query.pageSize
  const rows = await sqlClient<PostRecord[]>`
    SELECT DISTINCT sp.id, sp.template_type AS "templateType", sp.title,
           sp.source_type AS "sourceType", sp.source_id AS "sourceId",
           sp.default_text AS "defaultText", sp.media_url AS "mediaUrl",
           sp.destination_url AS "destinationUrl", sp.status, sp.origin,
           COALESCE(u.full_name, u.username) AS "createdByName", sp.created_at AS "createdAt",
           sp.updated_at AS "updatedAt", sp.published_at AS "publishedAt"
    FROM social_posts sp
    JOIN users u ON u.id = sp.created_by_user_id
    JOIN social_post_targets spt ON spt.social_post_id = sp.id
    JOIN social_channels sc ON sc.id = spt.social_channel_id
    WHERE (${query.from ?? null}::date IS NULL OR sp.created_at >= ${query.from ?? null}::date)
      AND (${query.to ?? null}::date IS NULL OR sp.created_at < ${query.to ?? null}::date + interval '1 day')
      AND (${query.platform ?? null}::text IS NULL OR sc.platform = ${query.platform ?? null})
      AND (${query.channelId ?? null}::int IS NULL OR sc.id = ${query.channelId ?? null})
      AND (${query.templateType ?? null}::text IS NULL OR sp.template_type = ${query.templateType ?? null})
      AND (${query.status ?? null}::text IS NULL OR spt.status = ${query.status ?? null})
      AND (${query.origin ?? null}::text IS NULL OR sp.origin = ${query.origin ?? null})
      AND (${query.source ?? null}::text IS NULL OR COALESCE(sp.title, '') ILIKE '%' || ${query.source ?? null} || '%')
    ORDER BY sp.created_at DESC LIMIT ${query.pageSize} OFFSET ${offset}
  `
  const counts = await sqlClient<{ count: number }[]>`
    SELECT COUNT(DISTINCT sp.id)::int AS count
    FROM social_posts sp
    JOIN social_post_targets spt ON spt.social_post_id = sp.id
    JOIN social_channels sc ON sc.id = spt.social_channel_id
    WHERE (${query.from ?? null}::date IS NULL OR sp.created_at >= ${query.from ?? null}::date)
      AND (${query.to ?? null}::date IS NULL OR sp.created_at < ${query.to ?? null}::date + interval '1 day')
      AND (${query.platform ?? null}::text IS NULL OR sc.platform = ${query.platform ?? null})
      AND (${query.channelId ?? null}::int IS NULL OR sc.id = ${query.channelId ?? null})
      AND (${query.templateType ?? null}::text IS NULL OR sp.template_type = ${query.templateType ?? null})
      AND (${query.status ?? null}::text IS NULL OR spt.status = ${query.status ?? null})
      AND (${query.origin ?? null}::text IS NULL OR sp.origin = ${query.origin ?? null})
      AND (${query.source ?? null}::text IS NULL OR COALESCE(sp.title, '') ILIKE '%' || ${query.source ?? null} || '%')
  `
  const targets = await targetsForPosts(rows.map((row) => row.id))
  const totalItems = counts[0]?.count ?? 0
  return {
    items: rows.map((row) => mapPost(row, targets.get(row.id) ?? [])),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / query.pageSize),
  }
}

type RuleRecord = Omit<SocialRuleDto, 'targetChannelIds' | 'lastEvaluatedAt' | 'createdAt' | 'updatedAt'> & {
  lastEvaluatedAt: DbTimestamp | null
  createdAt: DbTimestamp
  updatedAt: DbTimestamp
}

export async function listSocialRules(): Promise<SocialRuleDto[]> {
  const rows = await sqlClient<RuleRecord[]>`
    SELECT id, title, template_type AS "templateType", trigger_type AS "triggerType",
           is_enabled AS "isEnabled", execution_mode AS "executionMode",
           to_char(start_time, 'HH24:MI') AS "startTime", to_char(end_time, 'HH24:MI') AS "endTime",
           threshold_percentage AS "thresholdPercentage", cooldown_minutes AS "cooldownMinutes",
           max_executions_per_day AS "maxExecutionsPerDay",
           max_executions_per_food_per_day AS "maxExecutionsPerFoodPerDay", priority,
           last_evaluated_at AS "lastEvaluatedAt", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM social_automation_rules ORDER BY priority, id
  `
  const targets = await sqlClient<Array<{ ruleId: number; channelId: number }>>`
    SELECT rule_id AS "ruleId", social_channel_id AS "channelId" FROM social_automation_rule_targets
  `
  return rows.map((row) => ({
    ...row,
    targetChannelIds: targets.filter((target) => target.ruleId === row.id).map((target) => target.channelId),
    lastEvaluatedAt: nullableIso(row.lastEvaluatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }))
}

export async function saveSocialRule(id: number | null, raw: unknown): Promise<SocialRuleDto> {
  const value = socialRuleWriteSchema.parse(raw)
  const timestamp = nowSql()
  const savedId = await sqlClient.begin(async (tx) => {
    const rows = id
      ? await tx<{ id: number }[]>`
          UPDATE social_automation_rules SET title = ${value.title}, template_type = ${value.templateType},
            trigger_type = ${value.triggerType}, is_enabled = ${value.isEnabled},
            execution_mode = ${value.executionMode}, start_time = ${value.startTime ?? null}::time,
            end_time = ${value.endTime ?? null}::time, threshold_percentage = ${value.thresholdPercentage ?? null},
            cooldown_minutes = ${value.cooldownMinutes ?? null}, max_executions_per_day = ${value.maxExecutionsPerDay ?? null},
            max_executions_per_food_per_day = ${value.maxExecutionsPerFoodPerDay ?? null},
            priority = ${value.priority}, updated_at = ${timestamp}
          WHERE id = ${id} RETURNING id
        `
      : await tx<{ id: number }[]>`
          INSERT INTO social_automation_rules
            (title, template_type, trigger_type, is_enabled, execution_mode, start_time, end_time,
             threshold_percentage, cooldown_minutes, max_executions_per_day,
             max_executions_per_food_per_day, priority, created_at, updated_at)
          VALUES (${value.title}, ${value.templateType}, ${value.triggerType}, ${value.isEnabled},
            ${value.executionMode}, ${value.startTime ?? null}::time, ${value.endTime ?? null}::time,
            ${value.thresholdPercentage ?? null}, ${value.cooldownMinutes ?? null},
            ${value.maxExecutionsPerDay ?? null}, ${value.maxExecutionsPerFoodPerDay ?? null},
            ${value.priority}, ${timestamp}, ${timestamp}) RETURNING id
        `
    if (!rows[0]) throw new NotFoundError('قانون انتشار پیدا نشد.')
    await tx`DELETE FROM social_automation_rule_targets WHERE rule_id = ${rows[0].id}`
    for (const channelId of value.targetChannelIds) {
      await tx`INSERT INTO social_automation_rule_targets (rule_id, social_channel_id) VALUES (${rows[0].id}, ${channelId})`
    }
    return rows[0].id
  })
  return (await listSocialRules()).find((rule) => rule.id === savedId)!
}

export async function getSocialSettings(): Promise<SocialSettingsDto> {
  const rows = await sqlClient<Array<Omit<SocialSettingsDto, 'defaultTargetChannelIds' | 'updatedAt'> & { updatedAt: DbTimestamp }>>`
    SELECT id, minimum_interval_minutes AS "minimumIntervalMinutes",
           maximum_posts_per_day AS "maximumPostsPerDay",
           maximum_food_promotion_per_food_per_day AS "maximumFoodPromotionPerFoodPerDay",
           maximum_limited_availability_per_food_per_day AS "maximumLimitedAvailabilityPerFoodPerDay",
           to_char(quiet_hours_start, 'HH24:MI') AS "quietHoursStart",
           to_char(quiet_hours_end, 'HH24:MI') AS "quietHoursEnd",
           default_execution_mode AS "defaultExecutionMode", updated_at AS "updatedAt"
    FROM social_settings WHERE singleton_key = true LIMIT 1
  `
  if (!rows[0]) throw new AppError('تنظیمات انتشار ایجاد نشده است؛ migration را اجرا کنید.')
  const targets = await sqlClient<{ channelId: number }[]>`
    SELECT social_channel_id AS "channelId" FROM social_settings_default_targets WHERE settings_id = ${rows[0].id}
  `
  return {
    ...rows[0],
    defaultTargetChannelIds: targets.map((target) => target.channelId),
    updatedAt: iso(rows[0].updatedAt),
  }
}

export async function saveSocialSettings(raw: unknown): Promise<SocialSettingsDto> {
  const value = socialSettingsWriteSchema.parse(raw)
  const settings = await getSocialSettings()
  await sqlClient.begin(async (tx) => {
    await tx`
      UPDATE social_settings SET minimum_interval_minutes = ${value.minimumIntervalMinutes},
        maximum_posts_per_day = ${value.maximumPostsPerDay},
        maximum_food_promotion_per_food_per_day = ${value.maximumFoodPromotionPerFoodPerDay},
        maximum_limited_availability_per_food_per_day = ${value.maximumLimitedAvailabilityPerFoodPerDay},
        quiet_hours_start = ${value.quietHoursStart}::time, quiet_hours_end = ${value.quietHoursEnd}::time,
        default_execution_mode = ${value.defaultExecutionMode}, updated_at = ${nowSql()}
      WHERE id = ${settings.id}
    `
    await tx`DELETE FROM social_settings_default_targets WHERE settings_id = ${settings.id}`
    for (const channelId of value.defaultTargetChannelIds) {
      await tx`INSERT INTO social_settings_default_targets (settings_id, social_channel_id) VALUES (${settings.id}, ${channelId})`
    }
  })
  return getSocialSettings()
}

type SuggestionRecord = Omit<SocialSuggestionDto, 'draft' | 'createdAt' | 'dismissedAt'> & {
  draftTitle: string
  draftText: string
  draftMediaUrl: string | null
  draftDestinationUrl: string | null
  createdAt: DbTimestamp
  dismissedAt: DbTimestamp | null
}

export async function listSocialSuggestions(date = businessDate()): Promise<SocialSuggestionDto[]> {
  const rows = await sqlClient<SuggestionRecord[]>`
    SELECT ss.id, ss.rule_id AS "ruleId", sar.title AS "ruleTitle",
           ss.template_type AS "templateType", ss.source_type AS "sourceType",
           ss.source_id AS "sourceId", ss.source_title AS "sourceTitle",
           ss.logical_date::text AS "logicalDate", ss.status, ss.reason,
           ss.draft_title AS "draftTitle", ss.draft_text AS "draftText",
           ss.draft_media_url AS "draftMediaUrl", ss.draft_destination_url AS "draftDestinationUrl",
           ss.created_at AS "createdAt", ss.dismissed_at AS "dismissedAt"
    FROM social_suggestions ss JOIN social_automation_rules sar ON sar.id = ss.rule_id
    WHERE ss.logical_date = ${date}::date ORDER BY ss.status = 'Pending' DESC, ss.created_at DESC
  `
  return rows.map((row) => ({
    id: row.id, ruleId: row.ruleId, ruleTitle: row.ruleTitle, templateType: row.templateType,
    sourceType: row.sourceType, sourceId: row.sourceId, sourceTitle: row.sourceTitle,
    logicalDate: row.logicalDate, status: row.status, reason: row.reason,
    draft: {
      templateType: row.templateType, title: row.draftTitle, sourceType: row.sourceType,
      sourceId: row.sourceId, defaultText: row.draftText, mediaUrl: row.draftMediaUrl,
      destinationUrl: row.draftDestinationUrl,
      ...(row.templateType === 'LimitedAvailability' ? { availabilityState: 'Limited' as const } : {}),
    },
    createdAt: iso(row.createdAt), dismissedAt: nullableIso(row.dismissedAt),
  }))
}

export async function dismissSocialSuggestion(id: number, userId: number) {
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE social_suggestions SET status = 'Dismissed', dismissed_by_user_id = ${userId},
      dismissed_at = ${nowSql()}, updated_at = ${nowSql()}
    WHERE id = ${id} AND status = 'Pending' RETURNING id
  `
  if (!rows[0]) throw new AppError('این پیشنهاد دیگر در انتظار بررسی نیست.')
}

export async function getSocialDashboard(): Promise<SocialDashboardDto> {
  const date = businessDate()
  const rows = await sqlClient<Array<{
    suggestionsToday: number
    publishedToday: number
    pendingTargets: number
    failedTargets: number
    activeChannels: number
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM social_suggestions WHERE logical_date = ${date}::date AND status = 'Pending') AS "suggestionsToday",
      (SELECT COUNT(*)::int FROM social_posts WHERE published_at >= ${date}::date AND published_at < ${date}::date + interval '1 day') AS "publishedToday",
      (SELECT COUNT(*)::int FROM social_post_targets WHERE status IN ('Pending', 'Publishing')) AS "pendingTargets",
      (SELECT COUNT(*)::int FROM social_post_targets WHERE status IN ('Failed', 'Unknown')) AS "failedTargets",
      (SELECT COUNT(*)::int FROM social_channels WHERE is_active = true) AS "activeChannels"
  `
  const timeline = await sqlClient<SocialDashboardDto['timeline']>`
    SELECT spt.id, COALESCE(sp.title, sp.template_type) AS title, sc.platform, spt.status,
           COALESCE(spt.published_at, spt.updated_at) AS "occurredAt"
    FROM social_post_targets spt
    JOIN social_posts sp ON sp.id = spt.social_post_id
    JOIN social_channels sc ON sc.id = spt.social_channel_id
    WHERE spt.updated_at >= ${date}::date ORDER BY spt.updated_at DESC LIMIT 12
  `
  return {
    ...(rows[0] ?? { suggestionsToday: 0, publishedToday: 0, pendingTargets: 0, failedTargets: 0, activeChannels: 0 }),
    autoPublishRequiresRunningApp: true,
    timeline: timeline.map((item) => ({ ...item, occurredAt: iso(item.occurredAt as unknown as DbTimestamp) })),
  }
}

type Candidate = { sourceType: string; sourceId: number | null; sourceTitle: string | null; reason: string }
async function automationCandidates(rule: SocialRuleDto, date: string): Promise<Candidate[]> {
  if (rule.triggerType === 'DailyMenu') {
    return sqlClient<Candidate[]>`
      SELECT dm.id AS "sourceId", 'DailyMenu' AS "sourceType", 'منوی امروز' AS "sourceTitle",
             'منوی امروز هنوز منتشر نشده است' AS reason
      FROM daily_menus dm WHERE dm.menu_date = ${date}::date AND dm.is_open = true
        AND EXISTS(SELECT 1 FROM daily_menu_items dmi WHERE dmi.daily_menu_id = dm.id AND dmi.is_available)
        AND NOT EXISTS(
          SELECT 1 FROM social_posts sp
          WHERE sp.source_type = 'DailyMenu' AND sp.source_id = dm.id
            AND sp.published_at >= ${date}::date AND sp.published_at < ${date}::date + interval '1 day'
        )
      LIMIT 1
    `
  }
  const common = rule.triggerType === 'Discount'
    ? sqlClient<Candidate[]>`
        SELECT dmi.id AS "sourceId", 'DailyMenuItem' AS "sourceType", f.name AS "sourceTitle",
               'تخفیف فعال شده است' AS reason
        FROM daily_menu_items dmi JOIN daily_menus dm ON dm.id = dmi.daily_menu_id
        JOIN foods f ON f.id = dmi.food_id
        WHERE dm.menu_date = ${date}::date AND dm.is_open AND dmi.is_available AND f.is_active
          AND dmi.discount_price IS NOT NULL ORDER BY dmi.discount_price / NULLIF(dmi.price, 0), dmi.id
      `
    : rule.triggerType === 'LimitedAvailability'
    ? sqlClient<Candidate[]>`
        SELECT dmi.id AS "sourceId", 'DailyMenuItem' AS "sourceType", f.name AS "sourceTitle",
               'وضعیت سفارش این غذا به محدوده محدود رسیده است' AS reason
        FROM daily_menu_items dmi JOIN daily_menus dm ON dm.id = dmi.daily_menu_id
        JOIN foods f ON f.id = dmi.food_id
        WHERE dm.menu_date = ${date}::date AND dm.is_open AND dmi.is_available AND f.is_active
          AND dmi.capacity_portions > 0
          AND ((dmi.capacity_portions - dmi.sold_portions) * 100.0 / dmi.capacity_portions) <= ${rule.thresholdPercentage ?? 35}
          AND dmi.capacity_portions - dmi.sold_portions > 0
        ORDER BY dmi.id
      `
    : sqlClient<Candidate[]>`
        SELECT dmi.id AS "sourceId", 'DailyMenuItem' AS "sourceType", f.name AS "sourceTitle",
               'این غذا امروز آماده معرفی است' AS reason
        FROM daily_menu_items dmi JOIN daily_menus dm ON dm.id = dmi.daily_menu_id
        JOIN foods f ON f.id = dmi.food_id
        WHERE dm.menu_date = ${date}::date AND dm.is_open AND dmi.is_available AND f.is_active
          AND dmi.capacity_portions > dmi.sold_portions
        ORDER BY (dmi.discount_price IS NOT NULL) DESC, dmi.id
      `
  return common
}

async function createSuggestion(
  tx: TransactionSql,
  rule: SocialRuleDto,
  candidate: Candidate,
  date: string,
  draft: SocialDraftDto,
) {
  const rows = await tx<{ id: number }[]>`
    INSERT INTO social_suggestions
      (rule_id, template_type, source_type, source_id, source_title, logical_date, status,
       reason, draft_title, draft_text, draft_media_url, draft_destination_url, created_at, updated_at)
    VALUES (${rule.id}, ${rule.templateType}, ${candidate.sourceType}, ${candidate.sourceId},
      ${candidate.sourceTitle}, ${date}::date, 'Pending', ${candidate.reason}, ${draft.title},
      ${draft.defaultText}, ${draft.mediaUrl}, ${draft.destinationUrl}, ${nowSql()}, ${nowSql()})
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  return rows[0]?.id ?? null
}

export async function evaluateSocialAutomation(now = new Date(), userId: number): Promise<SocialAutomationEvaluationDto> {
  const date = businessDate(now)
  const currentMinutes = businessMinutesOfDay(now)
  const settings = await getSocialSettings()
  if (isWithinSocialTimeWindow(currentMinutes, settings.quietHoursStart, settings.quietHoursEnd)) {
    // A quiet range represents blocked time, unlike a rule window which represents allowed time.
    const start = socialTimeMinutes(settings.quietHoursStart)
    const end = socialTimeMinutes(settings.quietHoursEnd)
    if (start != null && end != null) return { createdSuggestions: 0, autoPublishPostIds: [], evaluatedAt: now.toISOString() }
  }
  const rules = (await listSocialRules()).filter((rule) => isSocialRuleEligible(rule, currentMinutes))
  const counts = await sqlClient<{ count: number; lastPublishedAt: DbTimestamp | null }[]>`
    SELECT COUNT(DISTINCT sp.id)::int AS count, MAX(sp.published_at) AS "lastPublishedAt"
    FROM social_posts sp WHERE sp.published_at >= ${date}::date AND sp.published_at < ${date}::date + interval '1 day'
  `
  if ((counts[0]?.count ?? 0) >= settings.maximumPostsPerDay) {
    return { createdSuggestions: 0, autoPublishPostIds: [], evaluatedAt: now.toISOString() }
  }
  const last = counts[0]?.lastPublishedAt ? new Date(counts[0].lastPublishedAt).getTime() : 0
  if (last && now.getTime() - last < settings.minimumIntervalMinutes * 60_000) {
    return { createdSuggestions: 0, autoPublishPostIds: [], evaluatedAt: now.toISOString() }
  }
  const autoRequests: Array<{ suggestionId: number; rule: SocialRuleDto; draft: SocialDraftDto }> = []
  let createdSuggestions = 0
  const remainingDailySlots = settings.maximumPostsPerDay - (counts[0]?.count ?? 0)
  await sqlClient.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('kafgir-social-automation-' || ${date}))`
    for (const rule of rules) {
      if (createdSuggestions >= remainingDailySlots) break
      if (rule.cooldownMinutes) {
        const latest = await tx<{ createdAt: DbTimestamp | null }[]>`
          SELECT MAX(created_at) AS "createdAt" FROM social_suggestions WHERE rule_id = ${rule.id}
        `
        const lastRuleRun = latest[0]?.createdAt ? new Date(latest[0].createdAt).getTime() : 0
        if (lastRuleRun && now.getTime() - lastRuleRun < rule.cooldownMinutes * 60_000) continue
      }
      const already = await tx<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM social_suggestions
        WHERE rule_id = ${rule.id} AND logical_date = ${date}::date
      `
      if (rule.maxExecutionsPerDay && (already[0]?.count ?? 0) >= rule.maxExecutionsPerDay) continue
      const candidates = await automationCandidates(rule, date)
      for (const candidate of candidates) {
        if (createdSuggestions >= remainingDailySlots) break
        const perSource = await tx<{ count: number }[]>`
          SELECT COUNT(*)::int AS count FROM social_suggestions
          WHERE rule_id = ${rule.id} AND logical_date = ${date}::date
            AND source_type = ${candidate.sourceType} AND COALESCE(source_id, 0) = COALESCE(${candidate.sourceId}, 0)
        `
        const sourceLimit = rule.maxExecutionsPerFoodPerDay ??
          (rule.templateType === 'LimitedAvailability'
            ? settings.maximumLimitedAvailabilityPerFoodPerDay
            : settings.maximumFoodPromotionPerFoodPerDay)
        if ((perSource[0]?.count ?? 0) >= sourceLimit) continue
        const draft = await generateSocialDraft({
          templateType: rule.templateType,
          sourceId: candidate.sourceId,
          menuDate: date,
        })
        const suggestionId = await createSuggestion(tx, rule, candidate, date, draft)
        if (!suggestionId) continue
        createdSuggestions += 1
        if (rule.executionMode === 'AutoPublish' && rule.targetChannelIds.length > 0) {
          autoRequests.push({ suggestionId, rule, draft })
        }
        if (rule.maxExecutionsPerDay && createdSuggestions >= rule.maxExecutionsPerDay) break
      }
      await tx`UPDATE social_automation_rules SET last_evaluated_at = ${now.toISOString()} WHERE id = ${rule.id}`
    }
  })
  const autoPublishPostIds: number[] = []
  for (const item of autoRequests) {
    const post = await createSocialPost({
      ...item.draft,
      targets: item.rule.targetChannelIds.map((channelId) => ({ channelId })),
      origin: 'Automation',
      suggestionId: item.suggestionId,
    }, userId)
    autoPublishPostIds.push(post.id)
  }
  return { createdSuggestions, autoPublishPostIds, evaluatedAt: now.toISOString() }
}

export async function markSuggestionPublishedForPost(tx: TransactionSql, postId: number) {
  await tx`
    UPDATE social_suggestions SET status = 'Published', updated_at = ${nowSql()}
    WHERE published_post_id = ${postId} AND status = 'Pending'
  `
}

export type { SocialHistoryQuery }
