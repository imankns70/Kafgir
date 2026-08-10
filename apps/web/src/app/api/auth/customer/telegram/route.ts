import { customerTelegramLoginSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { createCustomerToken, requireSameOrigin, setCustomerCookie } from '@/server/auth/customer-session'
import { UnauthorizedError } from '@/server/errors'
import { readJson, routeError } from '@/server/http'
import { loginTelegramCustomer } from '@/server/services/customer-auth-service'
import { getCustomerProfileByUserId } from '@/server/services/customer-service'
import { validateTelegramInitData } from '@/server/telegram/validation'
import { safelyAssociateAnalyticsSession } from '@/server/analytics-request'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJson(request, customerTelegramLoginSchema)
    const telegram = validateTelegramInitData(body.telegramInitData)
    if (!telegram.valid || !telegram.identity?.userId) throw new UnauthorizedError(telegram.error)
    const userId = await loginTelegramCustomer(telegram.identity)
    const session = await createCustomerToken({ userId, method: 'telegram' })
    const response = NextResponse.json({
      authenticated: true,
      method: 'telegram',
      profile: await getCustomerProfileByUserId(userId),
    })
    setCustomerCookie(response, session.token, session.expiresAt)
    await safelyAssociateAnalyticsSession(request, userId, response)
    return response
  } catch (error) {
    return routeError(error)
  }
}
