import { analyticsHeartbeatSchema } from '@kafgir/contracts'
import type { NextResponse } from 'next/server'
import { recordCustomerActivity } from '@kafgir/server-core'
import { errorFields, logger } from './logging/logger'

export const analyticsVisitorCookie = 'kafgir_visitor_id'
export const analyticsSessionCookie = 'kafgir_analytics_session'
const cookieMaxAge = 400 * 24 * 60 * 60

function cookieValue(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get('cookie')?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) ?? null
}

export function analyticsIdentifiersFromRequest(request: Request) {
  const parsed = analyticsHeartbeatSchema.safeParse({
    visitorId: cookieValue(request, analyticsVisitorCookie),
    sessionId: cookieValue(request, analyticsSessionCookie),
  })
  return parsed.success ? parsed.data : null
}

export function setAnalyticsCookies(
  response: NextResponse,
  identifiers: { visitorId: string; sessionId: string },
) {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookieMaxAge,
  }
  response.cookies.set(analyticsVisitorCookie, identifiers.visitorId, options)
  response.cookies.set(analyticsSessionCookie, identifiers.sessionId, options)
}

export async function safelyAssociateAnalyticsSession(
  request: Request,
  userId: number,
  response?: NextResponse,
  recordActivity = recordCustomerActivity,
) {
  const identifiers = analyticsIdentifiersFromRequest(request)
  if (!identifiers) return
  try {
    const result = await recordActivity(identifiers, userId)
    if (response) setAnalyticsCookies(response, result)
  } catch (error) {
    logger.warn({ event: 'analytics.identity.association.failed', userId, ...errorFields(error) },
      'اتصال نشست تحلیلی به مشتری انجام نشد')
  }
}
