import { NextRequest } from 'next/server'
import { updateOrderStatusSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, noContent, routeError } from '@/server/http'
import { updateOrderStatus } from '@/server/services/order-service'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const admin = await requireAdmin(request)
    await updateOrderStatus(Number((await context.params).id), await readJson(request, updateOrderStatusSchema), admin.userId)
    return noContent()
  } catch (error) {
    return routeError(error)
  }
}
