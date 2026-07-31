import { NextRequest, NextResponse } from 'next/server'
import { dailyMenuItemWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { addMenuItem } from '@/server/services/menu-service'

type Context = { params: Promise<{ date: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const date = (await context.params).date
    return NextResponse.json(await addMenuItem(date, await readJson(request, dailyMenuItemWriteSchema)), { status: 201 })
  } catch (error) {
    return routeError(error)
  }
}
