import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/errors'
import { routeError } from '@/server/http'
import { processNotifications } from '@/server/services/notification-service'
import { cancelStalePendingOrders } from '@/server/services/pending-order-service'

export async function POST(request: Request) {
  try {
    const expected = process.env.NOTIFICATION_PROCESSOR_SECRET
    if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
      throw new UnauthorizedError()
    }
    // The same once-a-minute call also retires pending orders nobody confirmed, before sending, so
    // the customer's cancellation notice goes out in this run.
    const autoCancelled = await cancelStalePendingOrders()
    return NextResponse.json({ processed: await processNotifications(), autoCancelled })
  } catch (error) {
    return routeError(error)
  }
}
