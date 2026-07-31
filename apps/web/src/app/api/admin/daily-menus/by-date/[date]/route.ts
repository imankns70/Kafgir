import { NextRequest, NextResponse } from 'next/server'
import { updateDailyMenuSettingsSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { getMenuByDate, updateMenuSettings } from '@/server/services/menu-service'

type Context = { params: Promise<{ date: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const menu = await getMenuByDate((await context.params).date)
    return menu ? NextResponse.json(menu) : NextResponse.json({ error: 'Menu was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireAdmin(request)
    const date = (await context.params).date
    return NextResponse.json(await updateMenuSettings(date, await readJson(request, updateDailyMenuSettingsSchema)))
  } catch (error) {
    return routeError(error)
  }
}
