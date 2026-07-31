import type { CustomerIdentityRequest } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { UnauthorizedError } from '../errors'
import { validateTelegramInitData, type TelegramIdentity } from '../telegram/validation'

function identityFromRequest(request: CustomerIdentityRequest) {
  const telegram = validateTelegramInitData(request.telegramInitData)
  if (telegram.valid && telegram.identity?.userId) return telegram.identity
  if (telegram.canUseDevelopmentFallback && request.telegramUserId) {
    return {
      userId: request.telegramUserId,
      username: request.telegramUsername ?? null,
      firstName: null,
      lastName: null,
    } satisfies TelegramIdentity
  }
  return null
}

export async function resolveCustomerUserId(
  request: CustomerIdentityRequest,
  required: boolean,
  verifiedIdentity?: TelegramIdentity,
): Promise<number | null> {
  const identity = verifiedIdentity ?? identityFromRequest(request)
  if (!identity?.userId) {
    if (required) throw new UnauthorizedError('برای انجام این کار باید از تلگرام وارد شوید.')
    return null
  }

  const existing = await sqlClient<{ id: number }[]>`
    SELECT user_id AS id
    FROM telegram_accounts
    WHERE telegram_user_id = ${identity.userId}
    LIMIT 1
  `
  if (existing[0]) {
    await sqlClient`
      UPDATE telegram_accounts
      SET username = ${identity.username}, first_name = ${identity.firstName},
          last_name = ${identity.lastName}, last_seen_at = NOW()
      WHERE telegram_user_id = ${identity.userId}
    `
    return existing[0].id
  }

  return sqlClient.begin(async (tx) => {
    const username = `tg_${identity.userId}`
    const fullName = [identity.firstName, identity.lastName].filter(Boolean).join(' ') || username
    const existingUsers = await tx<{ id: number }[]>`
      SELECT id
      FROM users
      WHERE telegram_user_id = ${identity.userId}
      LIMIT 1
    `
    const users = existingUsers[0]
      ? existingUsers
      : await tx<{ id: number }[]>`
      INSERT INTO users
        (username, normalized_username, full_name, telegram_user_id, telegram_first_name,
         telegram_last_name, is_active, created_at, last_seen_at, email_confirmed,
         phone_number_confirmed, two_factor_enabled, lockout_enabled, access_failed_count,
         password_hash_scheme, allows_write_to_pm)
      VALUES
        (${username}, ${username.toUpperCase()}, ${fullName}, ${identity.userId},
         ${identity.firstName}, ${identity.lastName}, true, NOW(), NOW(), false,
         false, false, true, 0, 'none', false)
      ON CONFLICT (normalized_username) DO UPDATE
        SET last_seen_at = NOW(), telegram_first_name = EXCLUDED.telegram_first_name,
            telegram_last_name = EXCLUDED.telegram_last_name
      RETURNING id
    `
    const userId = users[0]!.id
    const roles = await tx<{ id: number }[]>`
      INSERT INTO roles (name, normalized_name, concurrency_stamp)
      VALUES ('Customer', 'CUSTOMER', ${crypto.randomUUID()})
      ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
    await tx`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (${userId}, ${roles[0]!.id})
      ON CONFLICT DO NOTHING
    `
    await tx`
      INSERT INTO telegram_accounts
        (user_id, telegram_user_id, username, first_name, last_name, language_code,
         allows_write_to_pm, chat_id, created_at, last_seen_at)
      VALUES
        (${userId}, ${identity.userId}, ${identity.username}, ${identity.firstName},
         ${identity.lastName}, NULL, false, ${String(identity.userId)}, NOW(), NOW())
      ON CONFLICT (telegram_user_id) DO UPDATE
        SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name, last_seen_at = NOW()
    `
    return userId
  })
}
