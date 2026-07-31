import { NextResponse } from 'next/server'
import { adminLoginSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { loginAdmin } from '@/server/services/auth-service'

export async function POST(request: Request) {
  try {
    return NextResponse.json(await loginAdmin(await readJson(request, adminLoginSchema)))
  } catch (error) {
    return routeError(error)
  }
}
