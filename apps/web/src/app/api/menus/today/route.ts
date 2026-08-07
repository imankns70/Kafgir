import { NextResponse } from 'next/server'
import { publicDailyMenuQuerySchema } from '@kafgir/contracts'
import { getPublicMenuPageByDate } from '@/server/services/menu-service'
import { businessDate } from '@/server/time'
import { routeError } from '@/server/http'

export async function GET(request: Request) {
  try {
    const parameters = Object.fromEntries(new URL(request.url).searchParams.entries())
    const query = publicDailyMenuQuerySchema.parse(parameters)
    const menu = await getPublicMenuPageByDate(businessDate(), query)
    return menu ? NextResponse.json(menu) : NextResponse.json({ error: 'Menu was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}
