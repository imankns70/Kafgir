import type {
  CustomerAddressDto,
  CustomerAddressWriteRequest,
  CustomerProfileDto,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { NotFoundError } from '../errors'
import { logger } from '../logging/logger'

type ProfileRecord = {
  id: number
  userId: number
  preferredName: string
  defaultPhoneNumber: string
  phoneNumberConfirmed: boolean
  telegramUserId: number | null
  telegramUsername: string | null
}

async function profileDto(profile: ProfileRecord): Promise<CustomerProfileDto> {
  const addresses = await sqlClient<CustomerAddressDto[]>`
    SELECT id, title, city, address_line AS "addressLine", is_default AS "isDefault"
    FROM customer_addresses
    WHERE customer_profile_id = ${profile.id} AND is_active = true
    ORDER BY is_default DESC, id
  `
  return { ...profile, addresses }
}

export async function getCustomerProfileByUserId(userId: number): Promise<CustomerProfileDto | null> {
  const profiles = await sqlClient<{
    id: number
    userId: number
    preferredName: string
    defaultPhoneNumber: string
    phoneNumberConfirmed: boolean
    telegramUserId: number | null
    telegramUsername: string | null
  }[]>`
    SELECT p.id, p.user_id AS "userId", p.preferred_name AS "preferredName",
           COALESCE(lp.normalized_phone_number, p.default_phone_number) AS "defaultPhoneNumber",
           (lp.id IS NOT NULL) AS "phoneNumberConfirmed",
           t.telegram_user_id AS "telegramUserId", t.username AS "telegramUsername"
    FROM customer_profiles p
    LEFT JOIN customer_login_phones lp ON lp.user_id = p.user_id
    LEFT JOIN telegram_accounts t ON t.user_id = p.user_id
    WHERE p.user_id = ${userId}
    LIMIT 1
  `
  const profile = profiles[0]
  if (!profile) return null
  return profileDto(profile)
}

export async function getCustomerProfileByTelegramId(telegramUserId: number): Promise<CustomerProfileDto | null> {
  const users = await sqlClient<{ userId: number }[]>`
    SELECT user_id AS "userId" FROM telegram_accounts WHERE telegram_user_id = ${telegramUserId} LIMIT 1
  `
  return users[0] ? getCustomerProfileByUserId(users[0].userId) : null
}

export async function updateCustomerProfile(userId: number, preferredName: string) {
  const result = await sqlClient`
    UPDATE customer_profiles SET preferred_name = ${preferredName}
    WHERE user_id = ${userId}
    RETURNING id
  `
  if (!result.count) throw new NotFoundError('پروفایل مشتری پیدا نشد.')
  await sqlClient`UPDATE users SET full_name = ${preferredName} WHERE id = ${userId}`
  logger.info({ event: 'customer.profile.updated', userId }, 'پروفایل مشتری ویرایش شد')
}

async function customerProfileId(userId: number) {
  const profiles = await sqlClient<{ id: number }[]>`
    SELECT id FROM customer_profiles WHERE user_id = ${userId} LIMIT 1
  `
  if (!profiles[0]) throw new NotFoundError('پروفایل مشتری پیدا نشد.')
  return profiles[0].id
}

async function ensureSingleDefault(profileId: number, addressId: number) {
  await sqlClient`
    UPDATE customer_addresses SET is_default = (id = ${addressId})
    WHERE customer_profile_id = ${profileId} AND is_active = true
  `
}

export async function createCustomerAddress(userId: number, input: CustomerAddressWriteRequest) {
  const profileId = await customerProfileId(userId)
  const inserted = await sqlClient<{ id: number }[]>`
    INSERT INTO customer_addresses
      (customer_profile_id, title, city, address_line, is_default, is_active, created_at)
    VALUES (${profileId}, ${input.title}, ${input.city}, ${input.addressLine},
            ${input.isDefault}, true, NOW())
    RETURNING id
  `
  const id = inserted[0]!.id
  const count = await sqlClient<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM customer_addresses
    WHERE customer_profile_id = ${profileId} AND is_active = true
  `
  if (input.isDefault || count[0]!.count === 1) await ensureSingleDefault(profileId, id)
  logger.info({ event: 'customer.address.created', userId, addressId: id }, 'آدرس مشتری ایجاد شد')
  return id
}

export async function updateCustomerAddress(userId: number, id: number, input: CustomerAddressWriteRequest) {
  const profileId = await customerProfileId(userId)
  const result = await sqlClient`
    UPDATE customer_addresses
    SET title = ${input.title}, city = ${input.city}, address_line = ${input.addressLine},
        is_default = ${input.isDefault}
    WHERE id = ${id} AND customer_profile_id = ${profileId} AND is_active = true
    RETURNING id
  `
  if (!result.count) throw new NotFoundError('آدرس پیدا نشد.')
  if (input.isDefault) await ensureSingleDefault(profileId, id)
  logger.info({ event: 'customer.address.updated', userId, addressId: id }, 'آدرس مشتری ویرایش شد')
}

export async function deleteCustomerAddress(userId: number, id: number) {
  const profileId = await customerProfileId(userId)
  const rows = await sqlClient<{ isDefault: boolean }[]>`
    UPDATE customer_addresses SET is_active = false, is_default = false
    WHERE id = ${id} AND customer_profile_id = ${profileId} AND is_active = true
    RETURNING is_default AS "isDefault"
  `
  if (!rows[0]) throw new NotFoundError('آدرس پیدا نشد.')
  const next = await sqlClient<{ id: number }[]>`
    SELECT id FROM customer_addresses
    WHERE customer_profile_id = ${profileId} AND is_active = true
    ORDER BY last_used_at DESC NULLS LAST, id LIMIT 1
  `
  const hasDefault = await sqlClient<{ value: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM customer_addresses
      WHERE customer_profile_id = ${profileId} AND is_active = true AND is_default = true) AS value
  `
  if (!hasDefault[0]?.value && next[0]) await ensureSingleDefault(profileId, next[0].id)
  logger.info({ event: 'customer.address.deleted', userId, addressId: id }, 'آدرس مشتری حذف شد')
}
