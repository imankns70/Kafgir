import { customerAddressWriteSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  createCustomerAddress,
  getCustomerProfileByUserId,
} from '@/server/services/customer-service'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'

export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    const profile = await getCustomerProfileByUserId(customer.userId)
    return NextResponse.json(profile?.addresses ?? [])
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'customerAccount')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('customerAccount', customerRateLimitIdentity(customer.userId))
    const body = await readJson(request, customerAddressWriteSchema)
    await createCustomerAddress(customer.userId, body)
    return NextResponse.json(await getCustomerProfileByUserId(customer.userId), { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
