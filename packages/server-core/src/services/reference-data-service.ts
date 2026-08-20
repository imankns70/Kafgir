import type {
  DeliveryMethod,
  DeliveryMethodSettingDto,
  DeliveryMethodSettingWriteRequest,
  FoodTagGroupDto,
  FoodTagGroupWriteRequest,
  PaymentMethod,
  PaymentMethodSettingDto,
  PaymentMethodSettingWriteRequest,
  PublicOrderOptionsDto,
  SupportSubjectDto,
  SupportSubjectWriteRequest,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import {
  channelLeftWithoutOption,
  channelLeftWithoutOptionMessage,
  type ChannelAvailability,
  type RemainingChannelOptions,
} from '../domain/checkout-method-rules'

type DbDate = Date | string
const iso = (value: DbDate) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()

type TagGroupRow = Omit<FoodTagGroupDto, 'createdAt' | 'updatedAt'> & {
  createdAt: DbDate
  updatedAt: DbDate
}

const tagGroupDto = (row: TagGroupRow): FoodTagGroupDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
})

export async function listFoodTagGroups(includeInactive = true): Promise<FoodTagGroupDto[]> {
  const rows = await sqlClient<TagGroupRow[]>`
    SELECT code, title, display_order AS "displayOrder", is_active AS "isActive",
           is_system AS "isSystem", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM food_tag_groups
    WHERE ${includeInactive} OR is_active = true
    ORDER BY display_order, code
  `
  return rows.map(tagGroupDto)
}

export async function createFoodTagGroup(input: FoodTagGroupWriteRequest): Promise<FoodTagGroupDto> {
  try {
    const rows = await sqlClient<TagGroupRow[]>`
      INSERT INTO food_tag_groups
        (code, title, display_order, is_active, is_system, created_at, updated_at)
      VALUES (${input.code}, ${input.title}, ${input.displayOrder}, ${input.isActive}, false, NOW(), NOW())
      RETURNING code, title, display_order AS "displayOrder", is_active AS "isActive",
                is_system AS "isSystem", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return tagGroupDto(rows[0]!)
  } catch (error) {
    if (String(error).includes('food_tag_groups_pkey')) throw new AppError('این کد گروه قبلاً ثبت شده است.')
    throw error
  }
}

export async function updateFoodTagGroup(
  code: string,
  input: FoodTagGroupWriteRequest,
): Promise<FoodTagGroupDto> {
  const current = await sqlClient<{ isSystem: boolean }[]>`
    SELECT is_system AS "isSystem" FROM food_tag_groups WHERE code = ${code} LIMIT 1
  `
  if (!current[0]) throw new NotFoundError('گروه تگ پیدا نشد.')
  if (current[0].isSystem && input.code !== code) {
    throw new AppError('کد گروه‌های سیستمی قابل تغییر نیست.')
  }
  try {
    const rows = await sqlClient<TagGroupRow[]>`
      UPDATE food_tag_groups SET code = ${input.code}, title = ${input.title},
        display_order = ${input.displayOrder}, is_active = ${input.isActive}, updated_at = NOW()
      WHERE code = ${code}
      RETURNING code, title, display_order AS "displayOrder", is_active AS "isActive",
                is_system AS "isSystem", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return tagGroupDto(rows[0]!)
  } catch (error) {
    if (String(error).includes('food_tag_groups_pkey')) throw new AppError('این کد گروه قبلاً ثبت شده است.')
    throw error
  }
}

type SupportSubjectRow = Omit<SupportSubjectDto, 'createdAt' | 'updatedAt'> & {
  createdAt: DbDate
  updatedAt: DbDate
}

const supportSubjectDto = (row: SupportSubjectRow): SupportSubjectDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
})

export async function listSupportSubjects(includeInactive = false): Promise<SupportSubjectDto[]> {
  const rows = await sqlClient<SupportSubjectRow[]>`
    SELECT id, system_key AS "systemKey", title, display_order AS "displayOrder",
           is_active AS "isActive", is_system AS "isSystem",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM support_subjects
    WHERE ${includeInactive} OR is_active = true
    ORDER BY display_order, id
  `
  return rows.map(supportSubjectDto)
}

export async function createSupportSubject(input: SupportSubjectWriteRequest): Promise<SupportSubjectDto> {
  const rows = await sqlClient<SupportSubjectRow[]>`
    INSERT INTO support_subjects
      (system_key, title, display_order, is_active, is_system, created_at, updated_at)
    VALUES (NULL, ${input.title}, ${input.displayOrder}, ${input.isActive}, false, NOW(), NOW())
    RETURNING id, system_key AS "systemKey", title, display_order AS "displayOrder",
              is_active AS "isActive", is_system AS "isSystem",
              created_at AS "createdAt", updated_at AS "updatedAt"
  `
  return supportSubjectDto(rows[0]!)
}

export async function updateSupportSubject(
  id: number,
  input: SupportSubjectWriteRequest,
): Promise<SupportSubjectDto> {
  const rows = await sqlClient<SupportSubjectRow[]>`
    UPDATE support_subjects SET title = ${input.title}, display_order = ${input.displayOrder},
      is_active = ${input.isActive}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, system_key AS "systemKey", title, display_order AS "displayOrder",
              is_active AS "isActive", is_system AS "isSystem",
              created_at AS "createdAt", updated_at AS "updatedAt"
  `
  if (!rows[0]) throw new NotFoundError('موضوع پشتیبانی پیدا نشد.')
  return supportSubjectDto(rows[0])
}

export async function listPaymentMethodSettings(
  audience: 'all' | 'customer' | 'manual' = 'all',
): Promise<PaymentMethodSettingDto[]> {
  return sqlClient<PaymentMethodSettingDto[]>`
    SELECT method, title, description, is_customer_enabled AS "isCustomerEnabled",
           is_manual_enabled AS "isManualEnabled", display_order AS "displayOrder"
    FROM payment_method_settings
    WHERE ${audience === 'all'} OR
      (${audience === 'customer'} AND is_customer_enabled) OR
      (${audience === 'manual'} AND is_manual_enabled)
    ORDER BY display_order, method
  `
}

/** Counts the other rows still enabled per channel, then applies the shared rule. */
async function assertChannelKeepsAnOption(
  table: 'payment_method_settings' | 'delivery_method_settings',
  method: number,
  input: ChannelAvailability,
  subject: string,
) {
  const others = await sqlClient<RemainingChannelOptions[]>`
    SELECT COUNT(*) FILTER (WHERE is_customer_enabled)::int AS customer,
           COUNT(*) FILTER (WHERE is_manual_enabled)::int AS manual
    FROM ${sqlClient(table)} WHERE method <> ${method}
  `
  const emptyChannel = channelLeftWithoutOption(others[0] ?? { customer: 0, manual: 0 }, input)
  if (emptyChannel) throw new AppError(channelLeftWithoutOptionMessage(subject, emptyChannel))
}

export async function updatePaymentMethodSetting(
  method: PaymentMethod,
  input: PaymentMethodSettingWriteRequest,
): Promise<PaymentMethodSettingDto> {
  await assertChannelKeepsAnOption('payment_method_settings', method, input, 'روش‌های پرداخت')
  const rows = await sqlClient<PaymentMethodSettingDto[]>`
    UPDATE payment_method_settings SET title = ${input.title}, description = ${input.description ?? null},
      is_customer_enabled = ${input.isCustomerEnabled}, is_manual_enabled = ${input.isManualEnabled},
      display_order = ${input.displayOrder}, updated_at = NOW()
    WHERE method = ${method}
    RETURNING method, title, description, is_customer_enabled AS "isCustomerEnabled",
              is_manual_enabled AS "isManualEnabled", display_order AS "displayOrder"
  `
  if (!rows[0]) throw new NotFoundError('روش پرداخت پیدا نشد.')
  return rows[0]
}

export async function listDeliveryMethodSettings(
  audience: 'all' | 'customer' | 'manual' = 'all',
): Promise<DeliveryMethodSettingDto[]> {
  return sqlClient<DeliveryMethodSettingDto[]>`
    SELECT method, title, description, is_customer_enabled AS "isCustomerEnabled",
           is_manual_enabled AS "isManualEnabled", display_order AS "displayOrder",
           delivery_fee::float8 AS "deliveryFee", minimum_order_amount::float8 AS "minimumOrderAmount",
           requires_courier AS "requiresCourier"
    FROM delivery_method_settings
    WHERE ${audience === 'all'} OR
      (${audience === 'customer'} AND is_customer_enabled) OR
      (${audience === 'manual'} AND is_manual_enabled)
    ORDER BY display_order, method
  `
}

export async function updateDeliveryMethodSetting(
  method: DeliveryMethod,
  input: DeliveryMethodSettingWriteRequest,
): Promise<DeliveryMethodSettingDto> {
  await assertChannelKeepsAnOption('delivery_method_settings', method, input, 'روش‌های دریافت')
  const rows = await sqlClient<DeliveryMethodSettingDto[]>`
    UPDATE delivery_method_settings SET title = ${input.title}, description = ${input.description ?? null},
      is_customer_enabled = ${input.isCustomerEnabled}, is_manual_enabled = ${input.isManualEnabled},
      display_order = ${input.displayOrder}, delivery_fee = ${input.deliveryFee},
      minimum_order_amount = ${input.minimumOrderAmount}, updated_at = NOW()
    WHERE method = ${method}
    RETURNING method, title, description, is_customer_enabled AS "isCustomerEnabled",
              is_manual_enabled AS "isManualEnabled", display_order AS "displayOrder",
              delivery_fee::float8 AS "deliveryFee", minimum_order_amount::float8 AS "minimumOrderAmount",
              requires_courier AS "requiresCourier"
  `
  if (!rows[0]) throw new NotFoundError('روش دریافت پیدا نشد.')
  return rows[0]
}

export async function getPublicOrderOptions(): Promise<PublicOrderOptionsDto> {
  const [paymentMethods, deliveryMethods] = await Promise.all([
    listPaymentMethodSettings('customer'),
    listDeliveryMethodSettings('customer'),
  ])
  return { paymentMethods, deliveryMethods }
}
