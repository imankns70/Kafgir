import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, noContent, routeError } from '@/server/http'
import { setFoodActive } from '@/server/services/food-service'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const body = await readJson(request, z.object({ isActive: z.boolean() }))
    await setFoodActive(Number((await context.params).id), body.isActive)
    return noContent()
  } catch (error) {
    return routeError(error)
  }
}
