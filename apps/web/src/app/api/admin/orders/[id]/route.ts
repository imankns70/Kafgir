import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { getOrder } from '@/server/services/order-service'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await getOrder(Number((await context.params).id)))
  } catch (error) {
    return routeError(error)
  }
}
