import { NextRequest, NextResponse } from 'next/server'
import { customerIdentitySchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { resolveCustomerUserId } from '@/server/services/customer-identity-service'
import { getFoodIdBySlug, setFoodFavorite } from '@/server/services/food-discovery-service'
import { requireSameOrigin } from '@/server/auth/customer-session'
import {
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
} from '@/server/rate-limit/customer-mutations'

type Context = { params: Promise<{ slug: string }> }

async function update(request: NextRequest, context: Context, favorite: boolean) {
  try {
    requireSameOrigin(request)
    await enforceCustomerMutationIp(request, 'foodInteraction')
    const identity = await readJson(request, customerIdentitySchema)
    const userId = await resolveCustomerUserId(identity, true)
    await enforceCustomerMutationIdentity('foodInteraction', customerRateLimitIdentity(userId!))
    const foodId = await getFoodIdBySlug((await context.params).slug)
    return NextResponse.json(await setFoodFavorite(foodId, userId!, favorite))
  } catch (error) {
    return routeError(error)
  }
}

export const PUT = (request: NextRequest, context: Context) => update(request, context, true)
export const DELETE = (request: NextRequest, context: Context) => update(request, context, false)
