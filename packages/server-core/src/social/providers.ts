import type { SocialPlatform } from '@kafgir/contracts'

export interface SocialProviderCredential {
  token: string
  apiBaseUrl?: string
}

export interface SocialPublishPayload {
  externalChannelId: string
  text: string
  mediaUrl: string | null
  destinationUrl: string | null
}

export interface SocialProviderResult {
  externalMessageId: string
}

export interface SocialConnectionTestResult {
  supported: boolean
  connected: boolean
  detail: string
}

export interface SocialPublisher {
  readonly platform: SocialPlatform
  publish(payload: SocialPublishPayload, credential: SocialProviderCredential): Promise<SocialProviderResult>
  testConnection(credential: SocialProviderCredential): Promise<SocialConnectionTestResult>
}

type ApiEnvelope = {
  ok?: boolean
  result?: { message_id?: string | number; id?: string | number }
  message?: string
  description?: string
  error?: string
}

const safeApiMessage = (response: ApiEnvelope, status: number) =>
  response.description || response.message || response.error || `خطای سرویس اجتماعی (${status})`

async function postForm(url: string, values: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => ({})) as ApiEnvelope
  if (!response.ok || body.ok === false) throw new Error(safeApiMessage(body, response.status))
  return body
}

function messageId(response: ApiEnvelope) {
  const value = response.result?.message_id ?? response.result?.id
  return value == null ? crypto.randomUUID() : String(value)
}

abstract class TelegramCompatiblePublisher implements SocialPublisher {
  abstract readonly platform: SocialPlatform
  protected abstract readonly defaultBaseUrl: string
  protected supportsInlineButton = true

  private endpoint(credential: SocialProviderCredential, method: string) {
    const base = (credential.apiBaseUrl?.trim() || this.defaultBaseUrl).replace(/\/$/u, '')
    return `${base}/bot${encodeURIComponent(credential.token)}/${method}`
  }

  async publish(payload: SocialPublishPayload, credential: SocialProviderCredential) {
    const linkMarkup = payload.destinationUrl && this.supportsInlineButton
      ? JSON.stringify({ inline_keyboard: [[{ text: 'مشاهده منو و ثبت سفارش', url: payload.destinationUrl }]] })
      : null
    const plainLink = payload.destinationUrl && !this.supportsInlineButton
      ? `\n\n${payload.destinationUrl}`
      : ''
    if (payload.mediaUrl) {
      const response = await postForm(this.endpoint(credential, 'sendPhoto'), {
        chat_id: payload.externalChannelId,
        photo: payload.mediaUrl,
        caption: `${payload.text}${plainLink}`.slice(0, 1024),
        ...(linkMarkup ? { reply_markup: linkMarkup } : {}),
      })
      return { externalMessageId: messageId(response) }
    }
    const response = await postForm(this.endpoint(credential, 'sendMessage'), {
      chat_id: payload.externalChannelId,
      text: `${payload.text}${plainLink}`,
      disable_web_page_preview: 'false',
      ...(linkMarkup ? { reply_markup: linkMarkup } : {}),
    })
    return { externalMessageId: messageId(response) }
  }

  async testConnection(credential: SocialProviderCredential): Promise<SocialConnectionTestResult> {
    const response = await postForm(this.endpoint(credential, 'getMe'), {})
    return {
      supported: true,
      connected: response.ok !== false,
      detail: response.ok === false ? 'ارتباط برقرار نشد.' : 'ارتباط ربات برقرار است.',
    }
  }
}

export class TelegramPublisher extends TelegramCompatiblePublisher {
  readonly platform = 'Telegram' as const
  protected readonly defaultBaseUrl = 'https://api.telegram.org'
}

export class BalePublisher extends TelegramCompatiblePublisher {
  readonly platform = 'Bale' as const
  protected readonly defaultBaseUrl = 'https://tapi.bale.ai'
}

export class EitaaPublisher implements SocialPublisher {
  readonly platform = 'Eitaa' as const

  private endpoint(credential: SocialProviderCredential, method: string) {
    const base = (credential.apiBaseUrl?.trim() || 'https://eitaayar.ir/api').replace(/\/$/u, '')
    return `${base}/${encodeURIComponent(credential.token)}/${method}`
  }

  async publish(payload: SocialPublishPayload, credential: SocialProviderCredential) {
    // Eitaa's public sender has a narrower feature set. Media and actions degrade to public URLs.
    const suffix = [payload.mediaUrl, payload.destinationUrl].filter(Boolean).join('\n')
    const response = await postForm(this.endpoint(credential, 'sendMessage'), {
      chat_id: payload.externalChannelId,
      text: `${payload.text}${suffix ? `\n\n${suffix}` : ''}`,
    })
    return { externalMessageId: messageId(response) }
  }

  async testConnection(): Promise<SocialConnectionTestResult> {
    return {
      supported: false,
      connected: false,
      detail: 'ایتا آزمون بدون ارسال ندارد؛ اعتبار اتصال هنگام اولین انتشار مشخص می‌شود.',
    }
  }
}

const publishers: Record<SocialPlatform, SocialPublisher> = {
  Telegram: new TelegramPublisher(),
  Bale: new BalePublisher(),
  Eitaa: new EitaaPublisher(),
}

export const socialPublisherFor = (platform: SocialPlatform) => publishers[platform]
