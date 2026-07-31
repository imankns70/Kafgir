import { NextRequest, NextResponse } from 'next/server'
import { foodWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, noContent, routeError } from '@/server/http'
import { getFood, updateFood } from '@/server/services/food-service'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await getFood(Number((await context.params).id)))
  } catch (error) {
    return routeError(error)
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    await updateFood(Number((await context.params).id), await readJson(request, foodWriteSchema))
    return noContent()
  } catch (error) {
    return routeError(error)
  }
}
