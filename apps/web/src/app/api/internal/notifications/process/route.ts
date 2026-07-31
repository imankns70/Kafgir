import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/errors'
import { routeError } from '@/server/http'
import { processNotifications } from '@/server/services/notification-service'

export async function POST(request: Request) {
  try {
    const expected = process.env.NOTIFICATION_PROCESSOR_SECRET
    if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
      throw new UnauthorizedError()
    }
    return NextResponse.json({ processed: await processNotifications() })
  } catch (error) {
    return routeError(error)
  }
}
