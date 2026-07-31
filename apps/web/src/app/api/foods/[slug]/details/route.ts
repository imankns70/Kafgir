import { NextRequest, NextResponse } from 'next/server'
import { customerIdentitySchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { getFoodDetail } from '@/server/services/food-discovery-service'
import { resolveCustomerUserId } from '@/server/services/customer-identity-service'

type Context = { params: Promise<{ slug: string }> }

function menuItemId(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('menuItemId')
  return value && Number.isInteger(Number(value)) ? Number(value) : null
}

export async function GET(request: NextRequest, context: Context) {
  try {
    return NextResponse.json(await getFoodDetail(
      (await context.params).slug,
      menuItemId(request),
      null,
    ))
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const identity = await readJson(request, customerIdentitySchema)
    const userId = await resolveCustomerUserId(identity, false)
    return NextResponse.json(await getFoodDetail(
      (await context.params).slug,
      menuItemId(request),
      userId,
    ))
  } catch (error) {
    return routeError(error)
  }
}

