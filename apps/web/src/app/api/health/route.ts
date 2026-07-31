import { NextResponse } from 'next/server'
import { sqlClient } from '@/server/db/client'
import { routeError } from '@/server/http'

export async function GET() {
  try {
    await sqlClient`SELECT 1`
    return NextResponse.json({ status: 'ok', service: 'Kafgir.Web' })
  } catch (error) {
    return routeError(error)
  }
}
