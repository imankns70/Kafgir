import { NextRequest, NextResponse } from 'next/server'
import { customerIdentitySchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { resolveCustomerUserId } from '@/server/services/customer-identity-service'
import { listFavoriteFoods } from '@/server/services/food-discovery-service'

export async function POST(request: NextRequest) {
  try {
    const identity = await readJson(request, customerIdentitySchema)
    const userId = await resolveCustomerUserId(identity, true)
    return NextResponse.json(await listFavoriteFoods(userId!))
  } catch (error) {
    return routeError(error)
  }
}

