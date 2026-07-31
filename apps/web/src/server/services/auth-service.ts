import type { AdminLoginRequest, AdminLoginResponse } from '@kafgir/contracts'
import { authenticateAdmin } from '@kafgir/server-core'
import { createAdminToken } from '../auth/jwt'

export async function loginAdmin(request: AdminLoginRequest): Promise<AdminLoginResponse> {
  const principal = await authenticateAdmin(request)
  const token = await createAdminToken(principal)
  return {
    accessToken: token.token,
    expiresAtUtc: token.expiresAt.toISOString(),
    username: principal.username,
    fullName: principal.fullName,
    roles: principal.roles,
  }
}
