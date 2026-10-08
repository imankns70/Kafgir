import { NextResponse } from 'next/server'
import { couponCheckSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { checkCouponForUser } from '@/server/services/coupon-service'
import { optionalCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { enforceCustomerMutationIp } from '@/server/rate-limit/customer-mutations'

/**
 * Checkout preview of a discount code. It shares the order rate limit, so it cannot be used to
 * guess codes faster than orders could; the order itself checks the code again before charging.
 */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'order')
    const body = await readJson(request, couponCheckSchema)
    const customer = await optionalCustomer(request)
    return NextResponse.json(await checkCouponForUser(body.code, body.subtotal, customer?.userId ?? null))
  } catch (error) {
    return routeError(error)
  }
}
