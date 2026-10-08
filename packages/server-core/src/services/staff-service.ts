import {
  adminRoleSchema,
  type AdminRole,
  type StaffCreateRequest,
  type StaffPasswordRequest,
  type StaffUpdateRequest,
  type StaffUserDto,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { hashPassword } from '../auth/password'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { logger } from '../logging/logger'

/**
 * Admin accounts. Customers share the `users` table, so «staff» means a user holding one of the
 * Admin roles. Two rules keep the business from locking itself out: there is always at least one
 * active Owner, and nobody can deactivate themselves or take away their own Owner role.
 */

const adminRoles = adminRoleSchema.options

type StaffRow = Omit<StaffUserDto, 'createdAt' | 'lastSeenAt' | 'roles'> & {
  roles: string[]
  createdAt: Date
  lastSeenAt: Date | null
}

const selectStaff = (where: ReturnType<typeof sqlClient.unsafe>) => sqlClient<StaffRow[]>`
  SELECT u.id, u.username, COALESCE(u.full_name, u.username) AS "fullName", u.is_active AS "isActive",
         u.created_at AS "createdAt", u.last_seen_at AS "lastSeenAt",
         ARRAY_AGG(r.name ORDER BY r.name) AS roles
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id AND r.name = ANY(${sqlClient.array([...adminRoles])}::text[])
  ${where}
  GROUP BY u.id
  ORDER BY u.is_active DESC, u.full_name
`

const dto = (row: StaffRow): StaffUserDto => ({
  ...row,
  roles: row.roles.filter((role): role is AdminRole => (adminRoles as readonly string[]).includes(role)),
  createdAt: new Date(row.createdAt).toISOString(),
  lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
})

export async function listStaff(): Promise<StaffUserDto[]> {
  return (await selectStaff(sqlClient.unsafe(''))).map(dto)
}

async function getStaff(id: number): Promise<StaffUserDto> {
  const rows = await selectStaff(sqlClient.unsafe(`WHERE u.id = ${Number(id)}`))
  if (!rows[0]) throw new NotFoundError('کاربر پیدا نشد.')
  return dto(rows[0])
}

async function setRoles(tx: TransactionSql, userId: number, roles: AdminRole[]) {
  const ids: number[] = []
  for (const role of roles) {
    const rows = await tx<{ id: number }[]>`
      INSERT INTO roles (name, normalized_name, concurrency_stamp)
      VALUES (${role}, ${role.toUpperCase()}, ${crypto.randomUUID()})
      ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id`
    ids.push(rows[0]!.id)
  }
  // Only the Admin roles are replaced; a customer role on the same user is left alone.
  await tx`
    DELETE FROM user_roles ur USING roles r
    WHERE ur.user_id = ${userId} AND ur.role_id = r.id AND r.name = ANY(${sqlClient.array([...adminRoles])}::text[])`
  for (const roleId of ids) {
    await tx`INSERT INTO user_roles (user_id, role_id) VALUES (${userId}, ${roleId}) ON CONFLICT DO NOTHING`
  }
}

async function audit(tx: TransactionSql, action: string, id: number, actorId: number, details: string | null) {
  await tx`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES (${action}, 'staff', ${id}, ${actorId}, ${details}, NOW())`
  logger.info({ event: action, entityType: 'staff', entityId: id, userId: actorId }, 'کاربر مدیریت به‌روزرسانی شد')
}

export async function createStaff(input: StaffCreateRequest, actorId: number): Promise<StaffUserDto> {
  const username = input.username.trim()
  const id = await sqlClient.begin(async (tx) => {
    const taken = await tx<{ id: number }[]>`SELECT id FROM users WHERE normalized_username = ${username.toUpperCase()}`
    if (taken[0]) throw new AppError('این نام کاربری قبلاً استفاده شده است.')
    const rows = await tx<{ id: number }[]>`
      INSERT INTO users (username, normalized_username, full_name, password_hash, password_hash_scheme,
        security_stamp, is_active, created_at)
      VALUES (${username}, ${username.toUpperCase()}, ${input.fullName.trim()}, ${hashPassword(input.password)}, 'scrypt',
        ${crypto.randomUUID()}, true, NOW())
      RETURNING id`
    const userId = rows[0]!.id
    await setRoles(tx, userId, input.roles)
    await audit(tx, 'staff.create', userId, actorId, `${username} — ${input.roles.join('، ')}`)
    return userId
  })
  return getStaff(id)
}

/** Owners who would remain active if `exceptUserId` lost its Owner role or was deactivated. */
async function otherActiveOwners(tx: TransactionSql, exceptUserId: number) {
  const rows = await tx<{ count: number }[]>`
    SELECT COUNT(DISTINCT u.id)::int AS count FROM users u
    JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'Owner' AND u.is_active AND u.id <> ${exceptUserId}`
  return rows[0]?.count ?? 0
}

export async function updateStaff(id: number, input: StaffUpdateRequest, actorId: number): Promise<StaffUserDto> {
  const before = await getStaff(id)
  await sqlClient.begin(async (tx) => {
    // Serialise role changes so two Owners cannot demote each other at the same moment.
    await tx`SELECT pg_advisory_xact_lock(hashtext('kafgir-staff-roles'))`
    const losesOwner = before.roles.includes('Owner') && (!input.roles.includes('Owner') || !input.isActive)
    if (id === actorId && !input.isActive) throw new AppError('نمی‌توانید حساب خودتان را غیرفعال کنید.')
    if (id === actorId && losesOwner) throw new AppError('نمی‌توانید نقش مالک را از خودتان بگیرید.')
    if (losesOwner && before.isActive && await otherActiveOwners(tx, id) === 0) {
      throw new AppError('دست‌کم یک مالک فعال باید بماند.')
    }
    await tx`
      UPDATE users SET full_name = ${input.fullName.trim()}, is_active = ${input.isActive},
        security_stamp = ${crypto.randomUUID()}
      WHERE id = ${id}`
    await setRoles(tx, id, input.roles)
    const changes = [
      before.isActive !== input.isActive ? (input.isActive ? 'فعال شد' : 'غیرفعال شد') : null,
      before.roles.join(',') !== [...input.roles].sort().join(',') ? `نقش‌ها: ${input.roles.join('، ')}` : null,
    ].filter(Boolean).join(' — ')
    await audit(tx, 'staff.update', id, actorId, changes || null)
  })
  return getStaff(id)
}

export async function resetStaffPassword(id: number, input: StaffPasswordRequest, actorId: number): Promise<void> {
  await getStaff(id)
  await sqlClient.begin(async (tx) => {
    await tx`
      UPDATE users SET password_hash = ${hashPassword(input.password)}, password_hash_scheme = 'scrypt',
        security_stamp = ${crypto.randomUUID()}, access_failed_count = 0
      WHERE id = ${id}`
    await audit(tx, 'staff.password', id, actorId, null)
  })
}

/**
 * The signed-in account as the database sees it now, so a desktop session ends soon after the
 * account is deactivated or loses its Admin roles. Null means the session must end.
 */
export async function currentAdminRoles(userId: number): Promise<AdminRole[] | null> {
  const rows = await sqlClient<{ isActive: boolean; roles: string[] | null }[]>`
    SELECT u.is_active AS "isActive",
           ARRAY_AGG(r.name) FILTER (WHERE r.name = ANY(${sqlClient.array([...adminRoles])}::text[])) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${userId}
    GROUP BY u.id`
  const row = rows[0]
  const roles = (row?.roles ?? []).filter((role): role is AdminRole => (adminRoles as readonly string[]).includes(role))
  return row?.isActive && roles.length > 0 ? roles : null
}
