import { resolveClientIp } from '../client-ip'
import { rateLimitStore } from './index'
import { rateLimitKey } from './key'
import { defaultRateLimitMessage, rateLimitPolicies } from './policies'
import { RateLimitError, type RateLimitPolicy } from './store'

export type CustomerMutationGroup = 'order' | 'cartSnapshot' | 'customerAccount' | 'foodInteraction'

const customerMutationPolicies = {
  order: {
    identity: rateLimitPolicies.orderPerIdentity,
    ip: rateLimitPolicies.orderPerIp,
  },
  cartSnapshot: {
    identity: rateLimitPolicies.cartSnapshotPerIdentity,
    ip: rateLimitPolicies.cartSnapshotPerIp,
  },
  customerAccount: {
    identity: rateLimitPolicies.customerAccountWritePerIdentity,
    ip: rateLimitPolicies.customerAccountWritePerIp,
  },
  foodInteraction: {
    identity: rateLimitPolicies.foodInteractionPerIdentity,
    ip: rateLimitPolicies.foodInteractionPerIp,
  },
} as const satisfies Record<CustomerMutationGroup, { identity: RateLimitPolicy; ip: RateLimitPolicy }>

async function enforce(policy: RateLimitPolicy, identity: string, operation: CustomerMutationGroup) {
  const store = rateLimitStore()
  const decision = await store.consume(rateLimitKey(policy.name, identity), policy)
  if (!decision.allowed) {
    throw new RateLimitError(
      policy.message ?? defaultRateLimitMessage,
      decision.retryAfterSeconds,
      { policy: policy.name, operation, storeDistributed: store.isDistributed },
    )
  }
}

export const customerRateLimitIdentity = (userId: number) => `customer:${userId}`
export const telegramRateLimitIdentity = (telegramUserId: number) => `telegram:${telegramUserId}`
export const visitorRateLimitIdentity = (visitorId: string) => `visitor:${visitorId}`
export const anonymousIpRateLimitIdentity = (ip: string) => `anonymous-ip:${ip}`

/** Consume the secondary trusted-IP safety dimension before parsing or executing business work. */
export async function enforceCustomerMutationIp(request: Request, group: CustomerMutationGroup) {
  await enforce(customerMutationPolicies[group].ip, `ip:${resolveClientIp(request)}`, group)
}

/** Consume the primary authenticated customer, signed Telegram, or first-party visitor dimension. */
export async function enforceCustomerMutationIdentity(group: CustomerMutationGroup, identity: string) {
  await enforce(customerMutationPolicies[group].identity, identity, group)
}

export { customerMutationPolicies }
