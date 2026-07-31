import { NextResponse } from 'next/server'
import { requireCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { getCustomerOrder } from '@/server/services/customer-service'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const customer = await requireCustomer(request)
    return NextResponse.json(await getCustomerOrder(customer.userId, Number((await context.params).id)))
  } catch (error) {
    return routeError(error)
  }
}
