import { NextResponse } from 'next/server'
import { createOrderSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { createOrder } from '@/server/services/order-service'
import { validateTelegramInitData } from '@/server/telegram/validation'
import { UnauthorizedError } from '@/server/errors'
import { optionalCustomer, requireSameOrigin } from '@/server/auth/customer-session'
import { confirmedPhoneForUser } from '@/server/services/customer-auth-service'
import { normalizeIranianMobile } from '@/server/auth/customer-phone'
import { analyticsIdentifiersFromRequest } from '@/server/analytics-request'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
  telegramRateLimitIdentity,
} from '@/server/rate-limit/customer-mutations'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'order')
    const body = await readJson(request, createOrderSchema)
    const customer = await optionalCustomer(request)
    if (customer?.method === 'phone') {
      const confirmedPhone = await confirmedPhoneForUser(customer.userId)
      if (!confirmedPhone || normalizeIranianMobile(body.phoneNumber) !== confirmedPhone) {
        throw new UnauthorizedError('شماره تحویل باید با شماره تاییدشده حساب شما یکسان باشد.')
      }
    }
    const telegram = validateTelegramInitData(body.telegramInitData)
    if (!customer && !telegram.valid) {
      throw new UnauthorizedError('برای ثبت سفارش، ابتدا با شماره موبایل وارد شوید یا برنامه را از داخل تلگرام باز کنید.')
    }
    const rateIdentity = customer
      ? customerRateLimitIdentity(customer.userId)
      : telegramRateLimitIdentity(telegram.identity!.userId!)
    await enforceCustomerMutationIdentity('order', rateIdentity)
    const identity = telegram.identity ?? {
      userId: body.telegramUserId ?? null,
      username: body.telegramUsername ?? null,
      firstName: null,
      lastName: null,
    }
    const order = await createOrder(
      body,
      identity,
      false,
      customer?.userId,
      telegram.valid || customer?.method === 'telegram',
      analyticsIdentifiersFromRequest(request) ?? undefined,
    )
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
