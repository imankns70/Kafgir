import { customerAddressWriteSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { readJson, routeError } from '@/server/http'
import {
  deleteCustomerAddress,
  getCustomerProfileByUserId,
  updateCustomerAddress,
} from '@/server/services/customer-service'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    const customer = await requireCustomer(request)
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
    const customer = await requireCustomer(request)
    await deleteCustomerAddress(customer.userId, Number((await context.params).id))
    return NextResponse.json(await getCustomerProfileByUserId(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}
