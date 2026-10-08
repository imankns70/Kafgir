import { AppError } from '../errors'
import { logger } from '../logging/logger'

export async function sendCustomerOtp(phoneNumber: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'smsir' : 'console')
  if (provider === 'console' && process.env.NODE_ENV !== 'production') {
    logger.info({ event: 'customer.otp.development', phoneSuffix: phoneNumber.slice(-4) }, 'کد ورود توسعه در کنسول نمایش داده شد')
    console.warn(`[Kafgir development OTP] ${phoneNumber.slice(-4)}: ${code}`)
    return
  }
  if (provider !== 'smsir') throw new Error('SMS_PROVIDER must be smsir in production.')

  const apiKey = process.env.SMSIR_API_KEY
  const templateId = Number(process.env.SMSIR_TEMPLATE_ID)
  const parameterName = process.env.SMSIR_CODE_PARAMETER ?? 'Code'
  if (!apiKey || !Number.isInteger(templateId) || templateId <= 0) {
    throw new Error('SMS.ir configuration is incomplete.')
  }

  const response = await fetch('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      mobile: phoneNumber,
      templateId,
      parameters: [{ name: parameterName, value: code }],
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new AppError('ارسال کد تایید ممکن نشد. کمی بعد دوباره تلاش کنید.', 503)
  }
}

/**
 * A free-text SMS, used for order status updates. SMS.ir sends free text from a dedicated line
 * (`SMSIR_LINE_NUMBER`); without one the message fails and the notification processor retries and
 * finally marks it failed, which the admin notification log shows.
 */
export async function sendSms(phoneNumber: string, text: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'smsir' : 'console')
  if (provider === 'console' && process.env.NODE_ENV !== 'production') {
    logger.info({ event: 'sms.development', phoneSuffix: phoneNumber.slice(-4) }, 'پیامک توسعه در کنسول نمایش داده شد')
    console.warn(`[Kafgir development SMS] ${phoneNumber.slice(-4)}: ${text}`)
    return
  }
  if (provider !== 'smsir') throw new Error('SMS_PROVIDER must be smsir in production.')
  const apiKey = process.env.SMSIR_API_KEY
  const lineNumber = Number(process.env.SMSIR_LINE_NUMBER)
  if (!apiKey || !Number.isSafeInteger(lineNumber) || lineNumber <= 0) {
    throw new Error('SMS.ir line number (SMSIR_LINE_NUMBER) is not configured.')
  }
  const response = await fetch('https://api.sms.ir/v1/send/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ lineNumber, messageText: text, mobiles: [phoneNumber] }),
    signal: AbortSignal.timeout(8_000),
  })
  const body = await response.json().catch(() => null) as { status?: number; message?: string } | null
  if (!response.ok || (body?.status !== undefined && body.status !== 1)) {
    throw new Error(`SMS.ir ${response.status}: ${body?.message ?? 'send failed'}`)
  }
}
