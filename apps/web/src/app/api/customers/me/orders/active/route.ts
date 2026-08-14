import { NextResponse } from 'next/server'
import { requireCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { listActiveCustomerOrderCards } from '@/server/services/active-customer-order-service'

export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    return NextResponse.json(await listActiveCustomerOrderCards(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}
