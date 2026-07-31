import { NextRequest, NextResponse } from 'next/server'
import { foodTagWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { updateFoodTag } from '@/server/services/catalog-service'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await updateFoodTag(
      Number((await context.params).id),
      await readJson(request, foodTagWriteSchema),
    ))
  } catch (error) {
    return routeError(error)
  }
}

