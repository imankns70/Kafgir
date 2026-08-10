import { afterEach, describe, expect, it, vi } from 'vitest'
import { BalePublisher, EitaaPublisher, TelegramPublisher } from './providers'

afterEach(() => vi.unstubAllGlobals())

describe('social providers', () => {
  it('sends a Telegram photo with a native order button', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      result: { message_id: 42 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await new TelegramPublisher().publish({
      externalChannelId: '@kafgir',
      text: 'منوی امروز',
      mediaUrl: 'https://cdn.example/menu.webp',
      destinationUrl: 'https://example.com',
    }, { token: 'secret-token' })
    expect(result.externalMessageId).toBe('42')
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/sendPhoto')
    const body = options.body as URLSearchParams
    expect(body.get('reply_markup')).toContain('مشاهده منو')
  })

  it('uses Bale own API base', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })))
    vi.stubGlobal('fetch', fetchMock)
    await new BalePublisher().publish({ externalChannelId: '1', text: 'سلام', mediaUrl: null, destinationUrl: null }, { token: 'token' })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('tapi.bale.ai')
  })

  it('degrades Eitaa media and action to plain links', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { id: 'e1' } })))
    vi.stubGlobal('fetch', fetchMock)
    await new EitaaPublisher().publish({
      externalChannelId: 'channel', text: 'پیشنهاد امروز',
      mediaUrl: 'https://cdn.example/a.webp', destinationUrl: 'https://example.com',
    }, { token: 'token' })
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = options.body as URLSearchParams
    expect(body.get('text')).toContain('https://cdn.example/a.webp')
    expect(body.get('text')).toContain('https://example.com')
  })
})
