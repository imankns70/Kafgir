import { createHmac } from 'node:crypto'

/**
 * Rate-limit keys are HMACs, never the identifier itself.
 *
 * A plain hash would not be enough: the Iranian mobile space is about 10^9 values, so a SHA-256 of a
 * phone number is reversible by exhaustive search in seconds. Keying under a secret means a heap
 * dump, a log line or a crash report cannot be turned back into the phone numbers or addresses that
 * were being limited.
 */

function keySecret(): string {
  const value = process.env.JWT_SIGNING_KEY
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV !== 'production') return 'development-rate-limit-key-secret-32-chars'
    throw new Error('JWT_SIGNING_KEY must contain at least 32 characters.')
  }
  return value
}

/**
 * Derives the storage key for one identity under one scope.
 *
 * `scope` keeps unrelated identifiers apart even when they share a value — an IP address used for
 * OTP requests and the same address used for order creation must not share a bucket.
 */
export function rateLimitKey(scope: string, identity: string): string {
  return createHmac('sha256', keySecret()).update(`${scope}:${identity}`).digest('hex')
}
