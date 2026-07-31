import { NextRequest, NextResponse } from 'next/server'
import { foodCategoryWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { updateFoodCategory } from '@/server/services/catalog-service'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await updateFoodCategory(
      Number((await context.params).id),
      await readJson(request, foodCategoryWriteSchema),
    ))
  } catch (error) {
    return routeError(error)
  }
}

