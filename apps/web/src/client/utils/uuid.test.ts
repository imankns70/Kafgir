import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUuid } from './uuid'

/** The pattern `customerAnalytics` validates stored identifiers against. */
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('randomUuid', () => {
  it('uses crypto.randomUUID when the browser exposes it', () => {
    const randomUUID = vi.fn(() => '11111111-1111-4111-8111-111111111111')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() })

    expect(randomUuid()).toBe('11111111-1111-4111-8111-111111111111')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('falls back to getRandomValues on a plain-HTTP LAN origin', () => {
    // A non-secure context omits `randomUUID` entirely; `getRandomValues` is still present.
    const getRandomValues = vi.fn((array: Uint8Array) => {
      array.fill(0xff)
      return array
    })
    vi.stubGlobal('crypto', { getRandomValues })

    const value = randomUuid()

    expect(getRandomValues).toHaveBeenCalledTimes(1)
    expect(value).toMatch(uuidV4)
    // All-ones input proves the version and variant bits are forced rather than passed through.
    expect(value).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('produces values the analytics validation accepts, across many draws', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = Math.floor(Math.random() * 256)
        }
        return array
      },
    })

    const values = Array.from({ length: 200 }, () => randomUuid())
    for (const value of values) expect(value).toMatch(uuidV4)
    expect(new Set(values).size).toBe(values.length)
  })

  it('sets the version and variant bits from an all-zero source', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => {
        array.fill(0)
        return array
      },
    })

    expect(randomUuid()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('reports null rather than throwing when Web Crypto is absent entirely', () => {
    vi.stubGlobal('crypto', undefined)
    expect(randomUuid()).toBeNull()
  })

  it('reports null when crypto exists but offers neither entry point', () => {
    vi.stubGlobal('crypto', {})
    expect(randomUuid()).toBeNull()
  })
})
