import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clientIpFromForwardedHeaders,
  resolveClientIp,
  trustedProxyHops,
  unknownClientIp,
} from './client-ip'

const client = '203.0.113.9'
const attacker = '198.51.100.7'
const edgeProxy = '192.0.2.10'
const loadBalancer = '192.0.2.11'

const requestWith = (headers: Record<string, string>) =>
  new Request('https://kafgir.example/api/auth/customer/otp/request', { method: 'POST', headers })

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS
  vi.unstubAllEnvs()
})

describe('spoofed X-Forwarded-For', () => {
  // The whole point of counting from the right: a caller may prepend anything, and it only pushes
  // the genuine entry further left. Before this change the first entry was used, so each of these
  // requests would have been given its own rate-limit bucket.
  it('ignores an address the caller prepended', () => {
    expect(clientIpFromForwardedHeaders(`${attacker}, ${client}`, null, 1)).toBe(client)
  })

  it('ignores an entire forged chain', () => {
    const forged = '10.0.0.1, 10.0.0.2, 10.0.0.3'
    expect(clientIpFromForwardedHeaders(`${forged}, ${client}`, null, 1)).toBe(client)
  })

  it('gives every forged header the same bucket rather than a fresh one', () => {
    const first = clientIpFromForwardedHeaders(`${attacker}, ${client}`, null, 1)
    const second = clientIpFromForwardedHeaders(`10.0.0.99, ${client}`, null, 1)
    expect(first).toBe(second)
  })

  it('does not let a caller-supplied x-real-ip win over the forwarded chain', () => {
    expect(clientIpFromForwardedHeaders(`${attacker}, ${client}`, attacker, 1)).toBe(client)
  })
})

describe('multiple proxy hops', () => {
  it('reads past two proxies', () => {
    const chain = `${client}, ${edgeProxy}`
    expect(clientIpFromForwardedHeaders(chain, null, 2)).toBe(client)
  })

  it('reads past two proxies when the caller also prepended a forgery', () => {
    const chain = `${attacker}, ${client}, ${edgeProxy}`
    expect(clientIpFromForwardedHeaders(chain, null, 2)).toBe(client)
  })

  it('reads past three proxies', () => {
    const chain = `${client}, ${edgeProxy}, ${loadBalancer}`
    expect(clientIpFromForwardedHeaders(chain, null, 3)).toBe(client)
  })

  it('refuses a chain shorter than the configured hop count', () => {
    // Fewer entries than proxies means the header did not traverse the chain we expect, so no
    // position in it was written by our infrastructure. Fail closed instead of guessing.
    expect(clientIpFromForwardedHeaders(client, null, 2)).toBe(unknownClientIp)
    expect(clientIpFromForwardedHeaders(`${client}, ${edgeProxy}`, null, 5)).toBe(unknownClientIp)
  })
})

describe('direct requests', () => {
  it('ignores forwarded headers entirely when no proxy is in front', () => {
    expect(clientIpFromForwardedHeaders(`${attacker}, ${client}`, attacker, 0)).toBe(unknownClientIp)
  })

  it('ignores x-real-ip when no proxy is in front', () => {
    expect(clientIpFromForwardedHeaders(null, client, 0)).toBe(unknownClientIp)
  })
})

describe('missing forwarded headers', () => {
  it('returns the shared unknown bucket when nothing is present', () => {
    expect(clientIpFromForwardedHeaders(null, null, 1)).toBe(unknownClientIp)
    expect(clientIpFromForwardedHeaders(undefined, undefined, 1)).toBe(unknownClientIp)
  })

  it('falls back to x-real-ip only when behind a proxy and no chain was sent', () => {
    expect(clientIpFromForwardedHeaders(null, client, 1)).toBe(client)
  })

  it('treats a blank or comma-only chain as absent', () => {
    expect(clientIpFromForwardedHeaders('   ', null, 1)).toBe(unknownClientIp)
    expect(clientIpFromForwardedHeaders(' , , ', null, 1)).toBe(unknownClientIp)
    expect(clientIpFromForwardedHeaders(' , , ', client, 1)).toBe(client)
  })
})

describe('entry normalization', () => {
  it('strips ports and IPv6 brackets', () => {
    expect(clientIpFromForwardedHeaders(`${client}:54321`, null, 1)).toBe(client)
    expect(clientIpFromForwardedHeaders('[2001:db8::1]:443', null, 1)).toBe('2001:db8::1')
    expect(clientIpFromForwardedHeaders('2001:DB8::1', null, 1)).toBe('2001:db8::1')
  })

  it('tolerates irregular spacing', () => {
    expect(clientIpFromForwardedHeaders(`  ${attacker} ,   ${client}  `, null, 1)).toBe(client)
  })

  it('discards entries that are not addresses so junk cannot become a bucket key', () => {
    expect(clientIpFromForwardedHeaders('not-an-ip', null, 1)).toBe(unknownClientIp)
    expect(clientIpFromForwardedHeaders(`not-an-ip, ${client}`, null, 1)).toBe(client)
  })
})

describe('TRUSTED_PROXY_HOPS configuration', () => {
  it('defaults to one proxy', () => {
    expect(trustedProxyHops()).toBe(1)
  })

  it('accepts an explicit count, including zero', () => {
    process.env.TRUSTED_PROXY_HOPS = '0'
    expect(trustedProxyHops()).toBe(0)
    process.env.TRUSTED_PROXY_HOPS = '3'
    expect(trustedProxyHops()).toBe(3)
  })

  it('treats an empty value as unset', () => {
    process.env.TRUSTED_PROXY_HOPS = '   '
    expect(trustedProxyHops()).toBe(1)
  })

  it('rejects a misconfigured value rather than guessing', () => {
    for (const invalid of ['-1', '1.5', 'two', 'NaN']) {
      process.env.TRUSTED_PROXY_HOPS = invalid
      expect(() => trustedProxyHops()).toThrow(/TRUSTED_PROXY_HOPS/u)
    }
  })

  it('refuses to start in production when the value is missing', () => {
    // Guessing a hop count in production ships an unverified chain length, and guessing one too low
    // is the exact bypass this module exists to close. Fail loudly at the first request instead.
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.TRUSTED_PROXY_HOPS
    expect(() => trustedProxyHops()).toThrow(/must be set explicitly in production/u)
    process.env.TRUSTED_PROXY_HOPS = '   '
    expect(() => trustedProxyHops()).toThrow(/must be set explicitly in production/u)
  })

  it('accepts an explicit production value, including zero', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.TRUSTED_PROXY_HOPS = '2'
    expect(trustedProxyHops()).toBe(2)
    process.env.TRUSTED_PROXY_HOPS = '0'
    expect(trustedProxyHops()).toBe(0)
  })

  it('keeps the local development value of 0 valid and effective', () => {
    // Mirrors apps/web/.env.local: nothing proxies `next dev`, so forwarded headers are ignored.
    process.env.TRUSTED_PROXY_HOPS = '0'
    expect(trustedProxyHops()).toBe(0)
    expect(clientIpFromForwardedHeaders(`${attacker}, ${client}`, client, trustedProxyHops()))
      .toBe(unknownClientIp)
  })

  it('still defaults outside production so tests and dev servers run unconfigured', () => {
    delete process.env.TRUSTED_PROXY_HOPS
    expect(() => trustedProxyHops()).not.toThrow()
  })
})

describe('resolveClientIp', () => {
  it('reads the headers from a real request', () => {
    const request = requestWith({ 'x-forwarded-for': `${attacker}, ${client}` })
    expect(resolveClientIp(request)).toBe(client)
  })

  it('honours the configured hop count', () => {
    process.env.TRUSTED_PROXY_HOPS = '2'
    const request = requestWith({ 'x-forwarded-for': `${client}, ${edgeProxy}` })
    expect(resolveClientIp(request)).toBe(client)
  })

  it('returns the unknown bucket for a request with no forwarded headers', () => {
    expect(resolveClientIp(requestWith({}))).toBe(unknownClientIp)
  })
})
