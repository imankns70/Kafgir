import { NextRequest, NextResponse } from 'next/server'
import { dailyMenuWriteSchema } from '@kafgir/contracts'
import { requireAdmin } from '@/server/auth/jwt'
import { readJson, routeError } from '@/server/http'
import { replaceMenu } from '@/server/services/menu-service'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await replaceMenu(await readJson(request, dailyMenuWriteSchema)))
  } catch (error) {
    return routeError(error)
  }
}
