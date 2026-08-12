import type { CustomerAddressDto, CustomerProfileDto } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { AppError } from '../errors'
import { normalizePhone } from '../domain/order-rules'

export function normalizeIranianMobile(value: string): string {
  const normalized = normalizePhone(value)
  const digits = normalized.replace(/^\+/u, '')
  const local = digits.startsWith('0098')
    ? `0${digits.slice(4)}`
    : digits.startsWith('98')
      ? `0${digits.slice(2)}`
      : digits.startsWith('9') && digits.length === 10
        ? `0${digits}`
        : digits
  if (!/^09\d{9}$/u.test(local)) throw new AppError('شماره موبایل معتبر نیست.')
  return local
}

export async function findCustomerByPhone(phoneNumber: string): Promise<CustomerProfileDto | null> {
  const phone = normalizeIranianMobile(phoneNumber)
  const international = `98${phone.slice(1)}`
  const profiles = await sqlClient<Array<Omit<CustomerProfileDto, 'addresses'>>>`
    SELECT p.id, p.user_id AS "userId", p.preferred_name AS "preferredName",
           COALESCE(lp.normalized_phone_number, p.default_phone_number, u.phone_number) AS "defaultPhoneNumber",
           (lp.id IS NOT NULL) AS "phoneNumberConfirmed",
           t.telegram_user_id AS "telegramUserId", t.username AS "telegramUsername"
    FROM customer_profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN customer_login_phones lp ON lp.user_id = p.user_id
    LEFT JOIN telegram_accounts t ON t.user_id = p.user_id
    WHERE lp.normalized_phone_number = ${phone}
       OR regexp_replace(COALESCE(p.default_phone_number, ''), '[^0-9]', '', 'g') IN (${phone}, ${international}, ${`0098${phone.slice(1)}`})
       OR regexp_replace(COALESCE(u.phone_number, ''), '[^0-9]', '', 'g') IN (${phone}, ${international}, ${`0098${phone.slice(1)}`})
    ORDER BY (lp.normalized_phone_number = ${phone}) DESC, p.id
    LIMIT 1
  `
  const profile = profiles[0]
  if (!profile) return null
  const addresses = await sqlClient<CustomerAddressDto[]>`
    SELECT id,title,city,address_line AS "addressLine",is_default AS "isDefault"
    FROM customer_addresses
    WHERE customer_profile_id=${profile.id} AND is_active=true
    ORDER BY is_default DESC,last_used_at DESC NULLS LAST,id
  `
  return { ...profile, defaultPhoneNumber: phone, addresses }
}
