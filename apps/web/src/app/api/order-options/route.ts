import { NextResponse } from 'next/server'
import { getPublicOrderOptions } from '@kafgir/server-core'
import { routeError } from '@/server/http'

export async function GET() {
  try {
    return NextResponse.json(await getPublicOrderOptions())
  } catch (error) {
    return routeError(error)
  }
}
