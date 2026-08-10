import { customerOtpRequestSchema } from '@kafgir/contracts'
import { NextResponse } from 'next/server'
import { requireSameOrigin } from '@/server/auth/customer-session'
import { resolveClientIp } from '@/server/client-ip'
import { readJson, routeError } from '@/server/http'
import { requestCustomerOtp } from '@/server/services/customer-auth-service'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const body = await readJson(request, customerOtpRequestSchema)
    await requestCustomerOtp(body.phoneNumber, resolveClientIp(request))
    return NextResponse.json({ accepted: true })
  } catch (error) {
    return routeError(error)
  }
}
