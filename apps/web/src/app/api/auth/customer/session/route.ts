import { NextResponse } from 'next/server'
import { clearCustomerCookie, optionalCustomer } from '@/server/auth/customer-session'
import { routeError } from '@/server/http'
import { getCustomerProfileByUserId } from '@/server/services/customer-service'

export async function GET(request: Request) {
  try {
    const principal = await optionalCustomer(request)
    if (!principal) {
      const response = NextResponse.json({ authenticated: false, method: null, profile: null })
      if (request.headers.get('cookie')?.includes('kafgir_customer_session=')) clearCustomerCookie(response)
      return response
    }
    const profile = await getCustomerProfileByUserId(principal.userId)
    if (!profile) {
      const response = NextResponse.json({ authenticated: false, method: null, profile: null })
      clearCustomerCookie(response)
      return response
    }
    return NextResponse.json({ authenticated: true, method: principal.method, profile })
  } catch (error) {
    return routeError(error)
  }
}
