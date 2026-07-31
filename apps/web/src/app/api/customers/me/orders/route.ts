import { NextResponse } from 'next/server'
import { requireCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { listCustomerOrders } from '@/server/services/customer-service'

export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    return NextResponse.json(await listCustomerOrders(customer.userId, page))
  } catch (error) {
    return routeError(error)
  }
}
