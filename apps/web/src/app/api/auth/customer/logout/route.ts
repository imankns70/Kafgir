import { NextResponse } from 'next/server'
import { clearCustomerCookie, requireSameOrigin } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { logger } from '@/server/logging/logger'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const response = NextResponse.json({ authenticated: false })
    clearCustomerCookie(response)
    logger.info({ event: 'customer.logout' }, 'خروج مشتری')
    return response
  } catch (error) {
    return routeError(error)
  }
}
