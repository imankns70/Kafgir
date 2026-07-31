import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramIdentity {
  userId: number | null
  username: string | null
  firstName: string | null
  lastName: string | null
}

export interface TelegramValidationResult {
  valid: boolean
  canUseDevelopmentFallback: boolean
  identity?: TelegramIdentity
  error?: string
}

export function validateTelegramInitData(initData?: string | null): TelegramValidationResult {
  const required = (process.env.TELEGRAM_REQUIRE_INIT_DATA ?? 'true').toLowerCase() === 'true'
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!initData || !token) {
    return {
      valid: false,
      canUseDevelopmentFallback: !required,
      error: 'Telegram initData is missing.',
    }
  }

  try {
    const values = new URLSearchParams(initData)
    const receivedHash = values.get('hash')
    if (!receivedHash) throw new Error('Telegram hash is missing.')
    values.delete('hash')
    values.delete('signature')
    const dataCheckString = [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(token).digest()
    const calculated = createHmac('sha256', secret).update(dataCheckString).digest()
    const received = Buffer.from(receivedHash, 'hex')
    if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) {
      throw new Error('Telegram signature is invalid.')
    }

    const authDate = Number(values.get('auth_date'))
    const maxAgeMinutes = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_MINUTES ?? 1440)
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeMinutes * 60) {
      throw new Error('Telegram initData has expired.')
    }

    const user = JSON.parse(values.get('user') ?? '{}') as {
      id?: number
      username?: string
      first_name?: string
      last_name?: string
    }
    if (!Number.isSafeInteger(user.id)) throw new Error('Telegram user is missing.')
    return {
      valid: true,
      canUseDevelopmentFallback: false,
      identity: {
        userId: user.id ?? null,
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
      },
    }
  } catch (error) {
    return {
      valid: false,
      canUseDevelopmentFallback: !required,
      error: error instanceof Error ? error.message : 'Telegram initData is invalid.',
    }
  }
}
