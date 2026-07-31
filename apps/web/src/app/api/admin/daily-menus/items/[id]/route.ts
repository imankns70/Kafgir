import { NextRequest, NextResponse } from 'next/server'
import { updateDailyMenuItemSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { removeMenuItem, updateMenuItem } from '@/server/services/menu-service'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const id = Number((await context.params).id)
    return NextResponse.json(await updateMenuItem(id, await readJson(request, updateDailyMenuItemSchema)))
  } catch (error) {
    return routeError(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await removeMenuItem(Number((await context.params).id)))
  } catch (error) {
    return routeError(error)
  }
}
