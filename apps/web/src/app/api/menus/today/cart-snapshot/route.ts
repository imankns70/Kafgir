import { NextResponse } from 'next/server'
import { menuCartSnapshotRequestSchema } from '@kafgir/contracts'
import { readJson, routeError } from '@/server/http'
import { getMenuCartSnapshotByDate } from '@/server/services/menu-service'
import { businessDate } from '@/server/time'
import { optionalCustomer } from '@/server/auth/customer-session'
import { analyticsIdentifiersFromRequest } from '@/server/analytics-request'
import { resolveClientIp } from '@/server/client-ip'
import {
  anonymousIpRateLimitIdentity,
  customerRateLimitIdentity,
  enforceCustomerMutationIdentity,
  enforceCustomerMutationIp,
  visitorRateLimitIdentity,
} from '@/server/rate-limit/customer-mutations'

export async function POST(request: Request) {
  try {
    await enforceCustomerMutationIp(request, 'cartSnapshot')
    const customer = await optionalCustomer(request)
    const visitor = analyticsIdentifiersFromRequest(request)
    const identity = customer
      ? customerRateLimitIdentity(customer.userId)
      : visitor
        ? visitorRateLimitIdentity(visitor.visitorId)
        : anonymousIpRateLimitIdentity(resolveClientIp(request))
    await enforceCustomerMutationIdentity('cartSnapshot', identity)
    const { items } = await readJson(request, menuCartSnapshotRequestSchema)
    const snapshot = await getMenuCartSnapshotByDate(businessDate(), items)
    return snapshot
      ? NextResponse.json(snapshot)
      : NextResponse.json({ error: 'Menu was not found.' }, { status: 404 })
  } catch (error) {
    return routeError(error)
  }
}
