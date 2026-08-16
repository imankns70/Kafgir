import { NextResponse } from 'next/server'
import { listSupportSubjects } from '@kafgir/server-core'
import { routeError } from '@/server/http'

export async function GET() {
  try {
    return NextResponse.json(await listSupportSubjects(false))
  } catch (error) {
    return routeError(error)
  }
}
