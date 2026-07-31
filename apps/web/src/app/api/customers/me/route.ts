import { NextResponse } from 'next/server'
import { customerProfileLookupSchema, customerProfileUpdateSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { validateTelegramInitData } from '@/server/telegram/validation'
import { UnauthorizedError } from '@/server/errors'
import {
  getCustomerProfileByTelegramId,
  getCustomerProfileByUserId,
  updateCustomerProfile,
} from '@/server/services/customer-service'
import { requireCustomer, requireSameOrigin } from '@/server/auth/customer-session'

export async function GET(request: Request) {
  try {
    const customer = await requireCustomer(request)
    const profile = await getCustomerProfileByUserId(customer.userId)
    return profile
      ? NextResponse.json(profile)
      : NextResponse.json({ error: 'Customer was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request)
    const customer = await requireCustomer(request)
    const body = await readJson(request, customerProfileUpdateSchema)
    await updateCustomerProfile(customer.userId, body.preferredName)
    return NextResponse.json(await getCustomerProfileByUserId(customer.userId))
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request, customerProfileLookupSchema)
    const telegram = validateTelegramInitData(body.telegramInitData)
    const userId = telegram.valid ? telegram.identity?.userId : telegram.canUseDevelopmentFallback ? body.telegramUserId : null
    if (!userId) throw new UnauthorizedError(telegram.error)
    const profile = await getCustomerProfileByTelegramId(userId)
    return profile ? NextResponse.json(profile) : NextResponse.json({ error: 'Customer was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}
