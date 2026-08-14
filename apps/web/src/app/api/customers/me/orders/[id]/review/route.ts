import { orderReviewWriteSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'
import { getCustomerOrderDetail, saveCustomerOrderReview } from '@/server/services/customer-order-service'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const customer = await requireCustomer(request)
    const order = await getCustomerOrderDetail(customer.userId, Number((await context.params).id))
    return NextResponse.json(order.review)
  } catch (error) {
    return routeError(error)
  }
}

async function save(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'orderFeedback')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('orderFeedback', customerRateLimitIdentity(customer.userId))
    const body = await readJson(request, orderReviewWriteSchema)
    return NextResponse.json(
      await saveCustomerOrderReview(customer.userId, Number((await context.params).id), body),
    )
  } catch (error) {
    return routeError(error)
  }
}

export const POST = save
export const PUT = save
