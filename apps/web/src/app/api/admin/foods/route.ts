import { NextRequest, NextResponse } from 'next/server'
import { foodWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { createFood, listFoods } from '@/server/services/food-service'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await listFoods())
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const food = await createFood(await readJson(request, foodWriteSchema))
    return NextResponse.json(food, { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
