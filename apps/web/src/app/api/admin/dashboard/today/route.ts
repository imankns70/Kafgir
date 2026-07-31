import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/jwt'
import { routeError } from '@/server/http'
import { getDashboard } from '@/server/services/dashboard-service'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await getDashboard())
  } catch (error) {
    return routeError(error)
  }
}
