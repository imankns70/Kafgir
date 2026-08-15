import { supportConversationCloseSchema, supportMessageWriteSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'
import {
  addCustomerSupportMessage,
  getCustomerSupportConversation,
  setCustomerSupportConversationClosed,
} from '@kafgir/server-core'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const customer = await requireCustomer(request)
    return NextResponse.json(
      await getCustomerSupportConversation(customer.userId, Number((await context.params).id)),
    )
  } catch (error) {
    return routeError(error)
  }
}

async function authorizeWrite(request: Request) {
  requireSameOrigin(request)
  await enforceCustomerMutationIp(request, 'orderFeedback')
  const customer = await requireCustomer(request)
  await enforceCustomerMutationIdentity('orderFeedback', customerRateLimitIdentity(customer.userId))
  return customer
}

export async function POST(request: Request, context: Context) {
  try {
    const customer = await authorizeWrite(request)
    const input = await readJson(request, supportMessageWriteSchema)
    return NextResponse.json(await addCustomerSupportMessage(
      customer.userId,
      Number((await context.params).id),
      input,
    ))
  } catch (error) {
    return routeError(error)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const customer = await authorizeWrite(request)
    const input = await readJson(request, supportConversationCloseSchema)
    return NextResponse.json(await setCustomerSupportConversationClosed(
      customer.userId,
      Number((await context.params).id),
      input.closed,
    ))
  } catch (error) {
    return routeError(error)
  }
}
