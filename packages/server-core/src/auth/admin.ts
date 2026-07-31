import type { AdminLoginRequest } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { UnauthorizedError } from '../errors'
import { logger } from '../logging/logger'
import { hashPassword, verifyPassword } from './password'

const allowedAdminRoles = new Set(['Owner', 'KitchenAdmin', 'OrderManager'])

type UserRecord = {
  id: number
  username: string
  fullName: string | null
  passwordHash: string | null
  passwordHashScheme: string
  isActive: boolean
}

export interface AdminPrincipal {
  userId: number
  username: string
  fullName: string
  roles: string[]
}

export async function authenticateAdmin(request: AdminLoginRequest): Promise<AdminPrincipal> {
  const normalized = request.username.toUpperCase()
  const records = await sqlClient<UserRecord[]>`
    SELECT id, username, full_name AS "fullName", password_hash AS "passwordHash",
           password_hash_scheme AS "passwordHashScheme", is_active AS "isActive"
    FROM users
    WHERE normalized_username = ${normalized}
    LIMIT 1
  `
  const user = records[0]
  if (!user?.isActive || !user.passwordHash ||
      !verifyPassword(request.password, user.passwordHash, user.passwordHashScheme)) {
    logger.warn({ event: 'auth.login.failed', username: request.username }, 'ورود ناموفق مدیریت')
    throw new UnauthorizedError('نام کاربری یا رمز عبور نادرست است.')
  }
  const roleRecords = await sqlClient<{ name: string }[]>`
    SELECT r.name
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${user.id}
  `
  const roles = roleRecords.map((role) => role.name)
  if (!roles.some((role) => allowedAdminRoles.has(role))) {
    logger.warn(
      { event: 'auth.login.forbidden', userId: user.id, username: user.username },
      'کاربر مجوز مدیریت ندارد',
    )
    throw new UnauthorizedError('این کاربر دسترسی مدیریت ندارد.')
  }
  if (user.passwordHashScheme !== 'scrypt') {
    await sqlClient`
      UPDATE users
      SET password_hash = ${hashPassword(request.password)}, password_hash_scheme = 'scrypt',
          security_stamp = ${crypto.randomUUID()}
      WHERE id = ${user.id}
    `
  }
  const principal = {
    userId: user.id,
    username: user.username,
    fullName: user.fullName || user.username,
    roles,
  }
  logger.info(
    { event: 'auth.login.succeeded', userId: user.id, username: user.username, roles },
    'ورود مدیریت موفق بود',
  )
  return principal
}
