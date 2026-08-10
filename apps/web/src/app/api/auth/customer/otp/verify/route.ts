import { customerOtpVerifySchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import {
  createCustomerToken,
  optionalCustomer,
  requireSameOrigin,
  setCustomerCookie,
} from '@/server/auth/customer-session'
import { resolveClientIp } from '@/server/client-ip'
import { readJson, routeError } from '@/server/http'
import { verifyCustomerOtp } from '@/server/services/customer-auth-service'
import { getCustomerProfileByUserId } from '@/server/services/customer-service'
import { safelyAssociateAnalyticsSession } from '@/server/analytics-request'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJson(request, customerOtpVerifySchema)
    const current = await optionalCustomer(request)
    const userId = await verifyCustomerOtp(
      body.phoneNumber,
      body.code,
      current?.method === 'telegram' ? current.userId : null,
      resolveClientIp(request),
    )
    const method = current?.method === 'telegram' ? 'telegram' : 'phone'
    const session = await createCustomerToken({ userId, method })
    const response = NextResponse.json({
      authenticated: true,
      method,
      profile: await getCustomerProfileByUserId(userId),
    })
    setCustomerCookie(response, session.token, session.expiresAt)
    await safelyAssociateAnalyticsSession(request, userId, response)
    return response
  } catch (error) {
    return routeError(error)
  }
}
