import { NextRequest, NextResponse } from 'next/server'
import { foodTagWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { createFoodTag, listFoodTags } from '@/server/services/catalog-service'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await listFoodTags(true))
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(
      await createFoodTag(await readJson(request, foodTagWriteSchema)),
      { status: 201 },
    )
  } catch (error) {
    return routeError(error)
  }
}

