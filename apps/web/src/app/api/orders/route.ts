import { NextResponse } from 'next/server'
import { createOrderSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { createOrder } from '@/server/services/order-service'
import { validateTelegramInitData } from '@/server/telegram/validation'
import { UnauthorizedError } from '@/server/errors'
import { optionalCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { confirmedPhoneForUser } from '@/server/services/customer-auth-service'
import { normalizeIranianMobile } from '@/server/auth/customer-phone'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJson(request, createOrderSchema)
    const customer = await optionalCustomer(request)
    if (customer?.method === 'phone') {
      const confirmedPhone = await confirmedPhoneForUser(customer.userId)
      if (!confirmedPhone || normalizeIranianMobile(body.phoneNumber) !== confirmedPhone) {
        throw new UnauthorizedError('شماره تحویل باید با شماره تاییدشده حساب شما یکسان باشد.')
      }
    }
    const telegram = validateTelegramInitData(body.telegramInitData)
    if (!customer && !telegram.valid && !telegram.canUseDevelopmentFallback) {
      throw new UnauthorizedError(telegram.error)
    }
    const identity = telegram.identity ?? {
      userId: body.telegramUserId ?? null,
      username: body.telegramUsername ?? null,
      firstName: null,
      lastName: null,
    }
    const order = await createOrder(
      body,
      identity,
      telegram.canUseDevelopmentFallback,
      customer?.userId,
    )
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
