import { NextResponse } from 'next/server'
import { isoDate } from '@kafgir/contracts'
import { getDeliveryPricing } from '@kafgir/server-core'
import { businessDate } from '@/server/time'
import { routeError } from '@/server/http'

/**
 * The customer delivery charge for one delivery date, per delivery method.
 *
 * Public, like `/api/delivery-slots`, because checkout needs it before the customer is
 * authenticated. It exposes only what the customer is charged — never the courier's payable rate,
 * and never who the courier is: choosing a courier is an Admin concern.
 *
 * The value shown here is display only. Order creation recalculates the effective fee server-side
 * from the same configuration, so a stale or tampered page cannot decide what an order costs.
 */
export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get('date')
    const date = requested ? isoDate.parse(requested) : businessDate()
    return NextResponse.json(await getDeliveryPricing(date))
  } catch (error) {
    return routeError(error)
  }
}
