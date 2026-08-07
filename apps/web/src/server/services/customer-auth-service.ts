import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, UnauthorizedError } from '../errors'
import { logger } from '../logging/logger'
import { normalizeIranianMobile } from '../auth/customer-phone'
import {
  isConflictingVerifiedPhoneLink,
  selectVerifiedPhoneCanonicalUserId,
  type CustomerLinkIdentity,
} from '../domain/customer-linking'
import { resolveCustomerUserId } from './customer-identity-service'
import { sendCustomerOtp } from './sms-service'
import type { TelegramIdentity } from '../telegram/validation'

const otpLifetimeMs = 2 * 60_000
const maxAttempts = 5

function otpSecret() {
  const value = process.env.CUSTOMER_OTP_SECRET
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV !== 'production') return process.env.JWT_SIGNING_KEY ?? 'development-customer-otp-secret-32-chars'
    throw new Error('CUSTOMER_OTP_SECRET must contain at least 32 characters.')
  }
  return value
}

const digest = (scope: string, value: string) =>
  createHmac('sha256', otpSecret()).update(`${scope}:${value}`).digest('hex')

const equalDigest = (left: string, right: string) => {
  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
}

export async function requestCustomerOtp(rawPhone: string, ip: string) {
  const phone = normalizeIranianMobile(rawPhone)
  const ipDigest = digest('ip', ip)
  const limits = await sqlClient<{ phoneMinute: number; phoneHour: number; ipHour: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE normalized_phone_number = ${phone} AND created_at > NOW() - INTERVAL '1 minute')::int AS "phoneMinute",
      COUNT(*) FILTER (WHERE normalized_phone_number = ${phone} AND created_at > NOW() - INTERVAL '1 hour')::int AS "phoneHour",
      COUNT(*) FILTER (WHERE request_ip_digest = ${ipDigest} AND created_at > NOW() - INTERVAL '1 hour')::int AS "ipHour"
    FROM customer_otp_challenges
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `
  const limit = limits[0]!
  if (limit.phoneMinute > 0 || limit.phoneHour >= 5 || limit.ipHour >= 20) {
    throw new AppError('درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید.', 429)
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await sendCustomerOtp(phone, code)
  await sqlClient`
    INSERT INTO customer_otp_challenges
      (normalized_phone_number, code_digest, request_ip_digest, attempts, expires_at, created_at)
    VALUES (${phone}, ${digest(`otp:${phone}`, code)}, ${ipDigest}, 0,
            ${new Date(Date.now() + otpLifetimeMs).toISOString()}, NOW())
  `
  logger.info({ event: 'customer.otp.requested', phoneSuffix: phone.slice(-4) }, 'کد ورود مشتری درخواست شد')
}

type CustomerCandidate = {
  userId: number
  profileId: number
  phone: string
  createdAt: Date | string
  telegramUserId: number | null
}

async function ensureCustomerProfile(tx: TransactionSql, userId: number, phone: string) {
  const existing = await tx<{ id: number }[]>`
    SELECT id FROM customer_profiles WHERE user_id = ${userId} LIMIT 1
  `
  if (existing[0]) return existing[0].id
  const user = await tx<{ fullName: string | null }[]>`
    SELECT full_name AS "fullName" FROM users WHERE id = ${userId} LIMIT 1
  `
  const inserted = await tx<{ id: number }[]>`
    INSERT INTO customer_profiles
      (user_id, preferred_name, default_phone_number, created_at)
    VALUES (${userId}, ${user[0]?.fullName || 'مشتری کفگیر'}, ${phone}, NOW())
    RETURNING id
  `
  return inserted[0]!.id
}

async function resolveVerifiedPhoneUser(tx: TransactionSql, phone: string, preferredUserId?: number | null) {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${`customer-phone:${phone}`}))`
  const mapped = await tx<CustomerLinkIdentity[]>`
    SELECT lp.user_id AS "userId", t.telegram_user_id AS "telegramUserId"
    FROM customer_login_phones lp
    LEFT JOIN telegram_accounts t ON t.user_id = lp.user_id
    WHERE lp.normalized_phone_number = ${phone}
    LIMIT 1
    FOR UPDATE OF lp
  `
  const preferred = preferredUserId
    ? await tx<CustomerLinkIdentity[]>`
        SELECT u.id AS "userId", t.telegram_user_id AS "telegramUserId"
        FROM users u
        LEFT JOIN telegram_accounts t ON t.user_id = u.id
        WHERE u.id = ${preferredUserId} AND u.is_active = true
        LIMIT 1
      `
    : []
  if (isConflictingVerifiedPhoneLink(preferred[0] ?? null, mapped[0] ?? null)) {
    logger.warn({
      event: 'customer.identity.link.rejected',
      preferredUserId,
      mappedUserId: mapped[0]?.userId,
      reason: 'phone-linked-to-another-telegram',
    }, 'اتصال موبایل به حساب تلگرام دیگری رد شد')
    throw new AppError('این شماره موبایل قبلاً به حساب تلگرام دیگری متصل شده است. ابتدا از همان حساب وارد شوید.', 409)
  }
  const rows = await tx<CustomerCandidate[]>`
    SELECT u.id AS "userId", p.id AS "profileId",
           COALESCE(NULLIF(p.default_phone_number, ''), u.phone_number, '') AS phone,
           p.created_at AS "createdAt", t.telegram_user_id AS "telegramUserId"
    FROM customer_profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN telegram_accounts t ON t.user_id = u.id
    WHERE u.is_active = true
    ORDER BY p.created_at, p.id
  `
  const candidates = rows.filter((row) => {
    try { return normalizeIranianMobile(row.phone) === phone } catch { return false }
  })

  let canonicalUserId = selectVerifiedPhoneCanonicalUserId(preferred[0] ?? null, mapped[0] ?? null, candidates)

  if (!canonicalUserId) {
    const username = `phone_${phone}`
    const users = await tx<{ id: number }[]>`
      INSERT INTO users
        (username, normalized_username, phone_number, full_name, is_active, created_at,
         last_seen_at, email_confirmed, phone_number_confirmed, two_factor_enabled,
         lockout_enabled, access_failed_count, password_hash_scheme, allows_write_to_pm)
      VALUES (${username}, ${username.toUpperCase()}, ${phone}, 'مشتری کفگیر', true, NOW(),
              NOW(), false, true, false, true, 0, 'none', false)
      RETURNING id
    `
    canonicalUserId = users[0]!.id
    const roles = await tx<{ id: number }[]>`
      INSERT INTO roles (name, normalized_name, concurrency_stamp)
      VALUES ('Customer', 'CUSTOMER', ${crypto.randomUUID()})
      ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
    await tx`INSERT INTO user_roles (user_id, role_id) VALUES (${canonicalUserId}, ${roles[0]!.id}) ON CONFLICT DO NOTHING`
  }

  const canonicalProfileId = await ensureCustomerProfile(tx, canonicalUserId, phone)
  for (const duplicate of candidates) {
    if (duplicate.userId === canonicalUserId) continue
    if (duplicate.telegramUserId) {
      logger.warn({
        event: 'customer.identity.merge.skipped',
        canonicalUserId,
        duplicateUserId: duplicate.userId,
        reason: 'duplicate-telegram-account',
      }, 'ادغام حساب دارای تلگرام دوم انجام نشد')
      continue
    }
    await tx`UPDATE orders SET customer_profile_id = ${canonicalProfileId} WHERE customer_profile_id = ${duplicate.profileId}`
    await tx`UPDATE customer_addresses SET customer_profile_id = ${canonicalProfileId} WHERE customer_profile_id = ${duplicate.profileId}`
    await tx`DELETE FROM customer_profiles WHERE id = ${duplicate.profileId}`
  }
  const defaultAddress = await tx<{ id: number }[]>`
    SELECT id FROM customer_addresses
    WHERE customer_profile_id = ${canonicalProfileId} AND is_active = true
    ORDER BY is_default DESC, last_used_at DESC NULLS LAST, id
    LIMIT 1
  `
  if (defaultAddress[0]) {
    await tx`
      UPDATE customer_addresses SET is_default = (id = ${defaultAddress[0].id})
      WHERE customer_profile_id = ${canonicalProfileId} AND is_active = true
    `
  }

  await tx`
    UPDATE users SET phone_number = ${phone}, phone_number_confirmed = true, last_seen_at = NOW()
    WHERE id = ${canonicalUserId}
  `
  await tx`
    UPDATE customer_profiles SET default_phone_number = ${phone}
    WHERE id = ${canonicalProfileId}
  `
  await tx`
    INSERT INTO customer_login_phones
      (user_id, normalized_phone_number, verified_at, created_at, updated_at)
    VALUES (${canonicalUserId}, ${phone}, NOW(), NOW(), NOW())
    ON CONFLICT (normalized_phone_number) DO UPDATE
      SET user_id = EXCLUDED.user_id, verified_at = NOW(), updated_at = NOW()
  `
  return canonicalUserId
}

export async function verifyCustomerOtp(rawPhone: string, code: string, preferredUserId?: number | null) {
  const phone = normalizeIranianMobile(rawPhone)
  if (preferredUserId) {
    const existingPhone = await confirmedPhoneForUser(preferredUserId)
    if (existingPhone && existingPhone !== phone) {
      throw new AppError('تغییر شماره موبایل باید از فرایند جداگانه تایید شماره انجام شود.')
    }
  }
  const result = await sqlClient.begin(async (tx) => {
    const challenges = await tx<{ id: number; codeDigest: string; attempts: number; expiresAt: Date | string }[]>`
      SELECT id, code_digest AS "codeDigest", attempts, expires_at AS "expiresAt"
      FROM customer_otp_challenges
      WHERE normalized_phone_number = ${phone} AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `
    const challenge = challenges[0]
    if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) {
      return { error: 'expired' as const }
    }
    if (challenge.attempts >= maxAttempts) return { error: 'attempts' as const }
    const valid = equalDigest(challenge.codeDigest, digest(`otp:${phone}`, code))
    if (!valid) {
      await tx`UPDATE customer_otp_challenges SET attempts = attempts + 1 WHERE id = ${challenge.id}`
      return { error: 'invalid' as const }
    }
    await tx`UPDATE customer_otp_challenges SET consumed_at = NOW() WHERE id = ${challenge.id}`
    return { userId: await resolveVerifiedPhoneUser(tx, phone, preferredUserId) }
  })
  if ('error' in result) {
    if (result.error === 'attempts') throw new AppError('تعداد تلاش مجاز تمام شده است.', 429)
    if (result.error === 'expired') throw new UnauthorizedError('کد تایید منقضی شده است.')
    throw new UnauthorizedError('کد تایید نادرست است.')
  }
  const userId = result.userId
  logger.info({ event: 'customer.login.succeeded', userId, method: 'phone' }, 'ورود مشتری موفق بود')
  return userId
}

export async function loginTelegramCustomer(identity: TelegramIdentity) {
  const userId = await resolveCustomerUserId({
    telegramInitData: null,
    telegramUserId: identity.userId,
    telegramUsername: identity.username,
  }, true, identity)
  await sqlClient.begin(async (tx) => {
    await ensureCustomerProfile(tx, userId!, '')
  })
  logger.info({ event: 'customer.login.succeeded', userId, method: 'telegram' }, 'ورود تلگرام مشتری موفق بود')
  return userId!
}

export async function confirmedPhoneForUser(userId: number) {
  const rows = await sqlClient<{ phone: string }[]>`
    SELECT normalized_phone_number AS phone FROM customer_login_phones WHERE user_id = ${userId} LIMIT 1
  `
  return rows[0]?.phone ?? null
}
