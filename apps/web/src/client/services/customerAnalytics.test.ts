import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackCustomerActivity } from './customerAnalytics'

const visitorKey = 'kafgir.analytics.visitor'
const sessionKey = 'kafgir.analytics.session'
const lastActivityKey = 'kafgir.analytics.lastActivity'

const storedVisitor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const storedSession = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  }
}

let storage: ReturnType<typeof fakeStorage>
let fetchMock: ReturnType<typeof vi.fn>

/** The identifiers the browser actually posted for the most recent heartbeat. */
function sentIdentifiers() {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, { body: string }]
  return JSON.parse(init.body) as { visitorId: string; sessionId: string }
}

beforeEach(() => {
  storage = fakeStorage()
  fetchMock = vi.fn(async () => ({ ok: false }))
  vi.stubGlobal('window', { localStorage: storage })
  vi.stubGlobal('document', { visibilityState: 'visible' })
  vi.stubGlobal('fetch', fetchMock)
  // A plain-HTTP LAN origin: `randomUUID` is absent, `getRandomValues` is not.
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array) => {
      for (let index = 0; index < array.length; index += 1) {
        array[index] = Math.floor(Math.random() * 256)
      }
      return array
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('customer analytics identity without crypto.randomUUID', () => {
  it('mints valid identifiers and posts a heartbeat on a plain-HTTP LAN origin', async () => {
    await trackCustomerActivity()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = sentIdentifiers()
    expect(sent.visitorId).toMatch(uuidV4)
    expect(sent.sessionId).toMatch(uuidV4)
    expect(storage.map.get(visitorKey)).toBe(sent.visitorId)
    expect(storage.map.get(sessionKey)).toBe(sent.sessionId)
  })

  it('reuses stored identifiers that are still valid and recent', async () => {
    storage.map.set(visitorKey, storedVisitor)
    storage.map.set(sessionKey, storedSession)
    storage.map.set(lastActivityKey, String(Date.now()))

    await trackCustomerActivity()

    expect(sentIdentifiers()).toEqual({ visitorId: storedVisitor, sessionId: storedSession })
  })

  it('keeps the visitor but starts a new session after the inactivity window', async () => {
    storage.map.set(visitorKey, storedVisitor)
    storage.map.set(sessionKey, storedSession)
    storage.map.set(lastActivityKey, String(Date.now() - 31 * 60_000))

    await trackCustomerActivity()

    const sent = sentIdentifiers()
    expect(sent.visitorId).toBe(storedVisitor)
    expect(sent.sessionId).not.toBe(storedSession)
    expect(sent.sessionId).toMatch(uuidV4)
  })

  it('replaces only the identifier that is malformed', async () => {
    storage.map.set(visitorKey, 'not-a-uuid')
    storage.map.set(sessionKey, storedSession)
    storage.map.set(lastActivityKey, String(Date.now()))

    await trackCustomerActivity()

    const sent = sentIdentifiers()
    expect(sent.visitorId).toMatch(uuidV4)
    expect(sent.visitorId).not.toBe('not-a-uuid')
    expect(sent.sessionId).toBe(storedSession)
  })

  it('prefers crypto.randomUUID when the context is secure', async () => {
    const randomUUID = vi.fn(() => '33333333-3333-4333-8333-333333333333')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() })

    await trackCustomerActivity()

    expect(randomUUID).toHaveBeenCalled()
    expect(sentIdentifiers().visitorId).toBe('33333333-3333-4333-8333-333333333333')
  })

  it('skips the heartbeat instead of throwing when no secure random source exists', async () => {
    vi.stubGlobal('crypto', {})

    await expect(trackCustomerActivity()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still reports under identifiers already stored when crypto is unusable', async () => {
    vi.stubGlobal('crypto', {})
    storage.map.set(visitorKey, storedVisitor)
    storage.map.set(sessionKey, storedSession)
    storage.map.set(lastActivityKey, String(Date.now()))

    await trackCustomerActivity()

    expect(sentIdentifiers()).toEqual({ visitorId: storedVisitor, sessionId: storedSession })
  })
})
