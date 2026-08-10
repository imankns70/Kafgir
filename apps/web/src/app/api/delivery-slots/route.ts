import { NextResponse } from 'next/server'
import { isoDate } from '@kafgir/contracts'
import { getDeliverySlotOptions } from '@kafgir/server-core'
import { businessDate } from '@/server/time'
import { routeError } from '@/server/http'

/**
 * Availability for one delivery date. Public, because checkout needs it before the customer is
 * authenticated, and it exposes only available/unavailable plus a reason — never remaining counts.
 * The date defaults to the business day rather than anything the browser believes about "today".
 */
export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get('date')
    const date = requested ? isoDate.parse(requested) : businessDate()
    return NextResponse.json(await getDeliverySlotOptions(date))
  } catch (error) {
    return routeError(error)
  }
}
