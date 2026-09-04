import { NextResponse } from 'next/server'
import { getMenuPlan } from '@kafgir/server-core'
import { routeError } from '@/server/http'

/** The rest of the Persian month, from the business day forward. Public: it is the shop's plan. */
export async function GET() {
  try {
    return NextResponse.json(await getMenuPlan())
  } catch (error) {
    return routeError(error)
  }
}
