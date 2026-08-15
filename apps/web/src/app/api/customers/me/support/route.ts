import { customerSupportConversationCreateSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'
import {
  createCustomerSupportConversation,
  listCustomerSupportConversations,
} from '@kafgir/server-core'

export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    return NextResponse.json(await listCustomerSupportConversations(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'orderFeedback')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('orderFeedback', customerRateLimitIdentity(customer.userId))
    const input = await readJson(request, customerSupportConversationCreateSchema)
    return NextResponse.json(await createCustomerSupportConversation(customer.userId, input), { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
