import { jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'
import { ForbiddenError, UnauthorizedError } from '../errors'
import type { AdminPrincipal } from '@kafgir/server-core'

const adminRoles = new Set(['Owner', 'KitchenAdmin', 'OrderManager'])

function jwtSecret() {
  const value = process.env.JWT_SIGNING_KEY
  if (!value || value.length < 32) throw new Error('JWT_SIGNING_KEY must contain at least 32 characters.')
  return new TextEncoder().encode(value)
}

export async function createAdminToken(principal: AdminPrincipal) {
  const minutes = Number(process.env.JWT_EXPIRES_MINUTES ?? 720)
  const expiresAt = new Date(Date.now() + minutes * 60_000)
  const token = await new SignJWT({
    username: principal.username,
    fullName: principal.fullName,
    roles: principal.roles,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(principal.userId))
    .setIssuer(process.env.JWT_ISSUER ?? 'Kafgir')
    .setAudience(process.env.JWT_AUDIENCE ?? 'Kafgir.Admin')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(jwtSecret())
  return { token, expiresAt }
}

export async function requireAdmin(request: NextRequest): Promise<AdminPrincipal> {
  const value = request.headers.get('authorization')
  if (!value?.startsWith('Bearer ')) throw new UnauthorizedError()
  try {
    const verified = await jwtVerify(value.slice(7), jwtSecret(), {
      issuer: process.env.JWT_ISSUER ?? 'Kafgir',
      audience: process.env.JWT_AUDIENCE ?? 'Kafgir.Admin',
    })
    const roles = Array.isArray(verified.payload.roles)
      ? verified.payload.roles.filter((role): role is string => typeof role === 'string')
      : []
    if (!roles.some((role) => adminRoles.has(role))) throw new ForbiddenError()
    const userId = Number(verified.payload.sub)
    if (!Number.isInteger(userId)) throw new UnauthorizedError()
    return {
      userId,
      username: String(verified.payload.username ?? ''),
      fullName: String(verified.payload.fullName ?? ''),
      roles,
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw error
    throw new UnauthorizedError()
  }
}
