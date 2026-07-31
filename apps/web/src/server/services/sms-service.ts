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
