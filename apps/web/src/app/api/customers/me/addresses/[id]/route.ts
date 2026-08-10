import { customerAddressWriteSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  deleteCustomerAddress,
  getCustomerProfileByUserId,
  updateCustomerAddress,
} from '@/server/services/customer-service'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'customerAccount')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('customerAccount', customerRateLimitIdentity(customer.userId))
    const body = await readJson(request, customerAddressWriteSchema)
    await updateCustomerAddress(customer.userId, Number((await context.params).id), body)
    return NextResponse.json(await getCustomerProfileByUserId(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'customerAccount')
    const customer = await requireCustomer(request)
    await enforceCustomerMutationIdentity('customerAccount', customerRateLimitIdentity(customer.userId))
    await deleteCustomerAddress(customer.userId, Number((await context.params).id))
    return NextResponse.json(await getCustomerProfileByUserId(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}
