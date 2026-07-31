import { NextResponse } from 'next/server'
import { getMenuByDate } from '@/server/services/menu-service'
import { businessDate } from '@/server/time'
import { routeError } from '@/server/http'

export async function GET() {
  try {
    const menu = await getMenuByDate(businessDate(), true)
    return menu ? NextResponse.json(menu) : NextResponse.json({ error: 'Menu was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}
