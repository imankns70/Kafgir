import { NextRequest, NextResponse } from 'next/server'
import { createOrderSchema, DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { createOrder, searchOrders } from '@/server/services/order-service'
import { businessDate } from '@/server/time'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const parameters = request.nextUrl.searchParams
    const numberValue = (name: string) => {
      const value = parameters.get(name)
      return value ? Number(value) : undefined
    }
    const orders = await searchOrders({
      date: parameters.get('date') || businessDate(),
      status: numberValue('status') as OrderStatus | undefined,
      orderNumber: parameters.get('orderNumber') ?? undefined,
      customerName: parameters.get('customerName') ?? undefined,
      phoneNumber: parameters.get('phoneNumber') ?? undefined,
      deliveryMethod: numberValue('deliveryMethod') as DeliveryMethod | undefined,
      paymentMethod: numberValue('paymentMethod') as PaymentMethod | undefined,
      foodName: parameters.get('foodName') ?? undefined,
    })
    return NextResponse.json(orders)
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await readJson(request, createOrderSchema)
    const order = await createOrder(body, {
      userId: null,
      username: null,
      firstName: null,
      lastName: null,
    }, true)
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
