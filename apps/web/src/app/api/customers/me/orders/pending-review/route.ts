import { NextResponse } from 'next/server'
import { requireCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { getPendingOrderReview } from '@/server/services/customer-order-service'

/**
 * Backs the post-delivery rating prompt. The customer is resolved from the session, never from the
 * request body, so this can only ever reveal the caller's own delivered-but-unrated order.
 */
export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    return NextResponse.json(await getPendingOrderReview(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}
