import { NextResponse } from 'next/server'
import { requireCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { confirmCustomerOrderDelivered } from '@/server/services/customer-order-delivery-service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const customer = await requireCustomer(request)
    const orderId = Number((await context.params).id)
    return NextResponse.json(await confirmCustomerOrderDelivered(customer.userId, orderId))
  } catch (error) {
    return routeError(error)
  }
}
