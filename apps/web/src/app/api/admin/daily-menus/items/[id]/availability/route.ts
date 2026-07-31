import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, noContent, routeError } from '@/server/http'
import { setMenuItemAvailability } from '@/server/services/menu-service'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const body = await readJson(request, z.object({ isAvailable: z.boolean() }))
    await setMenuItemAvailability(Number((await context.params).id), body.isAvailable)
    return noContent()
  } catch (error) {
    return routeError(error)
  }
}
