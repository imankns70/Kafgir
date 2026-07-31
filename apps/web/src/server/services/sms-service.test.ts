import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendCustomerOtp } from './sms-service'

describe('SMS.ir customer OTP sender', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SMS_PROVIDER
    delete process.env.SMSIR_API_KEY
    delete process.env.SMSIR_TEMPLATE_ID
    delete process.env.SMSIR_CODE_PARAMETER
  })

  it('sends the verification template without exposing credentials in the URL', async () => {
    process.env.SMS_PROVIDER = 'smsir'
    process.env.SMSIR_API_KEY = 'secret-key'
    process.env.SMSIR_TEMPLATE_ID = '12345'
    process.env.SMSIR_CODE_PARAMETER = 'Code'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await sendCustomerOtp('09121234567', '123456')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.sms.ir/v1/send/verify')
    expect(init?.headers).toMatchObject({ 'x-api-key': 'secret-key' })
    expect(JSON.parse(String(init?.body))).toEqual({
      mobile: '09121234567',
      templateId: 12345,
      parameters: [{ name: 'Code', value: '123456' }],
    })
  })

  it('fails closed when production configuration is incomplete', async () => {
    process.env.SMS_PROVIDER = 'smsir'
    await expect(sendCustomerOtp('09121234567', '123456')).rejects.toThrow('configuration is incomplete')
  })

  it('reports provider failures as a service error', async () => {
    process.env.SMS_PROVIDER = 'smsir'
    process.env.SMSIR_API_KEY = 'secret-key'
    process.env.SMSIR_TEMPLATE_ID = '12345'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    await expect(sendCustomerOtp('09121234567', '123456')).rejects.toMatchObject({ status: 503 })
  })
})
