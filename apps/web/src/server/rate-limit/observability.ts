import { logger } from '../logging/logger'

export type RateLimitRejectionMetadata = {
  /** Stable, non-sensitive policy/scope name from the centralized policy registry. */
  policy: string
  /** Stable route group or operation name, never a URL containing caller-controlled data. */
  operation: string
  retryAfterSeconds: number
  storeDistributed: boolean
}

export type RateLimitRejectionLogFields = RateLimitRejectionMetadata & {
  event: 'rate_limit.rejected'
  status: 429
}

type RejectionLogWriter = (fields: RateLimitRejectionLogFields, message: string) => void

/**
 * Emits one intentionally small event for a rejected request.
 *
 * The allowlist construction is deliberate: even if a caller accidentally passes an object with
 * request data at runtime, only these five safe fields can reach the logger.
 */
export function logRateLimitRejection(
  metadata: RateLimitRejectionMetadata,
  write: RejectionLogWriter = (fields, message) => logger.warn(fields, message),
) {
  write({
    event: 'rate_limit.rejected',
    status: 429,
    policy: metadata.policy,
    operation: metadata.operation,
    retryAfterSeconds: metadata.retryAfterSeconds,
    storeDistributed: metadata.storeDistributed,
  }, 'درخواست به دلیل محدودیت نرخ رد شد')
}
