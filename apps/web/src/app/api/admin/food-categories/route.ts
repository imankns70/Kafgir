import { NextRequest, NextResponse } from 'next/server'
import { foodCategoryWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { createFoodCategory, listFoodCategories } from '@/server/services/catalog-service'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await listFoodCategories(true))
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(
      await createFoodCategory(await readJson(request, foodCategoryWriteSchema)),
      { status: 201 },
    )
  } catch (error) {
    return routeError(error)
  }
}

