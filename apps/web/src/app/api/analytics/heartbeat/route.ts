import { analyticsHeartbeatSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { recordCustomerActivity } from '@kafgir/server-core'
import { optionalCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson } from '@/server/http'
import { errorFields, logger } from '@/server/logging/logger'
import { setAnalyticsCookies } from '@/server/analytics-request'
import { rateLimitPolicies, withRateLimit } from '@/server/rate-limit'

async function handle(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJson(request, analyticsHeartbeatSchema)
    const customer = await optionalCustomer(request)
    const result = await recordCustomerActivity(body, customer?.userId ?? null)
    const response = NextResponse.json(result)
    setAnalyticsCookies(response, result)
    return response
  } catch (error) {
    logger.warn({ event: 'analytics.heartbeat.failed', ...errorFields(error) },
      'ثبت فعالیت بازدیدکننده انجام نشد')
    return NextResponse.json({ error: 'Analytics unavailable.' }, { status: 503 })
  }
}

export const POST = withRateLimit(
  { policy: rateLimitPolicies.analyticsHeartbeatPerIp, operation: 'analyticsHeartbeat' },
  handle,
)
