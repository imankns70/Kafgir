import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateTelegramInitData } from './validation'

const botToken = '123456:TEST_BOT_TOKEN'

function signedInitData(authDate: number) {
  const values = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({ id: 123456789, first_name: 'Iman', username: 'iman' }),
  })
  const dataCheckString = [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  values.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))
  return values.toString()
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Telegram initData validation', () => {
  it('accepts matching signed data', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', botToken)
    vi.stubEnv('TELEGRAM_REQUIRE_INIT_DATA', 'true')
    const result = validateTelegramInitData(signedInitData(Math.floor(Date.now() / 1000)))
    expect(result.valid).toBe(true)
    expect(result.identity?.userId).toBe(123456789)
    expect(result.identity?.username).toBe('iman')
  })

  it('rejects tampered data', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', botToken)
    vi.stubEnv('TELEGRAM_REQUIRE_INIT_DATA', 'true')
    const tampered = signedInitData(Math.floor(Date.now() / 1000)).replace('iman', 'other')
    expect(validateTelegramInitData(tampered).valid).toBe(false)
  })

  it('rejects expired data', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', botToken)
    vi.stubEnv('TELEGRAM_REQUIRE_INIT_DATA', 'true')
    vi.stubEnv('TELEGRAM_INIT_DATA_MAX_AGE_MINUTES', '1')
    const result = validateTelegramInitData(signedInitData(Math.floor(Date.now() / 1000) - 120))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('allows missing data when development fallback is configured', () => {
    vi.stubEnv('TELEGRAM_REQUIRE_INIT_DATA', 'false')
    const result = validateTelegramInitData(null)
    expect(result.valid).toBe(false)
    expect(result.canUseDevelopmentFallback).toBe(true)
  })

  it('requires missing data when fallback is disabled', () => {
    vi.stubEnv('TELEGRAM_REQUIRE_INIT_DATA', 'true')
    const result = validateTelegramInitData(null)
    expect(result.valid).toBe(false)
    expect(result.canUseDevelopmentFallback).toBe(false)
  })
})
