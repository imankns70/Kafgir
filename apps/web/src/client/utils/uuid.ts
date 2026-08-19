'use client'

/**
 * A random UUID v4, or `null` when the browser offers no secure source for one.
 *
 * `crypto.randomUUID` is restricted to secure contexts, which means HTTPS **or** `localhost` — a
 * plain-HTTP LAN address such as `http://192.168.70.176:3000` is not one, so the property is simply
 * absent there and calling it throws `crypto.randomUUID is not a function`. `crypto.getRandomValues`
 * carries no such restriction, so the bytes are drawn from it and shaped into a v4 by hand.
 *
 * There is deliberately no `Math.random` path. An identifier produced from a predictable source is
 * worse than no identifier: it would collide across visitors and silently corrupt the analytics it
 * is meant to feed. Callers treat `null` as "skip this heartbeat" instead.
 */
export function randomUuid(): string | null {
  const webCrypto: Crypto | undefined = globalThis.crypto
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID()
  if (typeof webCrypto?.getRandomValues !== 'function') return null

  const bytes = webCrypto.getRandomValues(new Uint8Array(16))
  // RFC 4122 §4.4: the high nibble of octet 6 is the version, and the two high bits of octet 8 are
  // the variant. Everything else stays random.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
