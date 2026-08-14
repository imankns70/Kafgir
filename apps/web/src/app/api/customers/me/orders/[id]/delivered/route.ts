import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'
import { confirmCustomerOrderDelivered } from '@/server/services/customer-order-delivery-service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'orderFeedback')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('orderFeedback', customerRateLimitIdentity(customer.userId))
    const orderId = Number((await context.params).id)
    return NextResponse.json(await confirmCustomerOrderDelivered(customer.userId, orderId))
  } catch (error) {
    return routeError(error)
  }
}
