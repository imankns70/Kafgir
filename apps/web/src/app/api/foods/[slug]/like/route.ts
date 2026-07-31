import { NextRequest, NextResponse } from 'next/server'
import { customerIdentitySchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { resolveCustomerUserId } from '@/server/services/customer-identity-service'
import { getFoodIdBySlug, setFoodLike } from '@/server/services/food-discovery-service'

type Context = { params: Promise<{ slug: string }> }

async function update(request: NextRequest, context: Context, liked: boolean) {
  try {
    const identity = await readJson(request, customerIdentitySchema)
    const userId = await resolveCustomerUserId(identity, true)
    const foodId = await getFoodIdBySlug((await context.params).slug)
    return NextResponse.json(await setFoodLike(foodId, userId!, liked))
  } catch (error) {
    return routeError(error)
  }
}

export const PUT = (request: NextRequest, context: Context) => update(request, context, true)
export const DELETE = (request: NextRequest, context: Context) => update(request, context, false)

