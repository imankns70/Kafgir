/**
 * Trusted client IP resolution.
 *
 * `X-Forwarded-For` is a list that grows left-to-right: each proxy appends the address of the peer
 * it received the request from. Only the rightmost entries are written by our own infrastructure —
 * everything to the left of those was either forwarded verbatim or supplied by the caller, so a
 * client can prepend as many fake addresses as it likes.
 *
 * We therefore count from the RIGHT, skipping exactly `TRUSTED_PROXY_HOPS` proxy-appended entries.
 * Fake entries prepended by a caller only push the real one further left; they never land on the
 * index we read. Reading the leftmost entry — the obvious-looking choice, and what this codebase did
 * before — lets any caller choose their own rate-limit bucket by sending one header.
 */

export const unknownClientIp = 'unknown'

/** Liara (like most managed hosts) terminates TLS at a single reverse proxy in front of Next.js. */
const defaultTrustedProxyHops = 1

/** Addresses only ever contain hex digits, dots, colons and IPv6 zone separators. */
const plausibleIp = /^[0-9a-f.:%]+$/u

/**
 * Number of proxies between the public internet and this process.
 *
 * `0` means requests arrive directly, so forwarded headers are attacker-controlled and are ignored
 * entirely. Misconfiguration is thrown rather than defaulted: a silently wrong hop count reads a
 * caller-supplied position and quietly disables every IP-keyed limit built on top of it.
 *
 * In production the value must be set explicitly. Falling back to a guess there would mean shipping
 * an unverified chain length, and guessing one too low is exactly the bypass this module exists to
 * close. Development keeps a default because nothing proxies `next dev`.
 */
export function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS
  if (raw === undefined || raw.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'TRUSTED_PROXY_HOPS must be set explicitly in production. Count how many entries your ' +
        'infrastructure appends to X-Forwarded-For and set that number, or 0 to ignore forwarded ' +
        'headers entirely.',
      )
    }
    return defaultTrustedProxyHops
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('TRUSTED_PROXY_HOPS must be a non-negative integer.')
  }
  return value
}

/** Trims an entry and strips the port and IPv6 brackets some proxies add. */
function normalizeIp(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('[')) {
    // "[::1]" or "[::1]:8080"
    const close = trimmed.indexOf(']')
    return close > 1 ? trimmed.slice(1, close).toLowerCase() : ''
  }
  // A single colon means IPv4 with a port; a bare IPv6 address always has several.
  const firstColon = trimmed.indexOf(':')
  const bare = firstColon > -1 && trimmed.indexOf(':', firstColon + 1) === -1
    ? trimmed.slice(0, firstColon)
    : trimmed
  const lowered = bare.toLowerCase()
  return plausibleIp.test(lowered) ? lowered : ''
}

/**
 * Pure resolution, so the hop arithmetic can be tested without constructing requests.
 *
 * Returns {@link unknownClientIp} whenever no value can be trusted. That is deliberately a single
 * shared bucket: callers that cannot be identified must not each get a private allowance.
 */
export function clientIpFromForwardedHeaders(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined,
  hops: number,
): string {
  // No proxy in front means nothing forwarded can be believed.
  if (hops <= 0) return unknownClientIp

  const entries = (forwardedFor ?? '')
    .split(',')
    .map(normalizeIp)
    .filter((entry) => entry.length > 0)

  if (entries.length > 0) {
    const index = entries.length - hops
    // A chain shorter than configured means the header did not pass through the proxies we expect,
    // so no position in it is one of ours.
    return index >= 0 ? entries[index]! : unknownClientIp
  }

  // Single-value header set by the same proxy tier; only meaningful when one is actually in front.
  return normalizeIp(realIp ?? '') || unknownClientIp
}

/** The caller's address as vouched for by our own proxies, or {@link unknownClientIp}. */
export function resolveClientIp(request: Request): string {
  return clientIpFromForwardedHeaders(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    trustedProxyHops(),
  )
}
