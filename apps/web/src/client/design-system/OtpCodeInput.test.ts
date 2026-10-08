import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeOtp, OtpCodeInput } from './OtpCodeInput'

describe('OTP code input', () => {
  it('accepts Persian, Arabic-Indic and spaced pasted codes', () => {
    expect(normalizeOtp('۴۶۶۸۸۱')).toBe('466881')
    expect(normalizeOtp('٤٦٦ ٨٨١')).toBe('466881')
    expect(normalizeOtp('466 881 99')).toBe('466881')
  })

  it('draws six boxes over one input the phone can fill from the SMS', () => {
    const markup = renderToStaticMarkup(createElement(OtpCodeInput, { value: '466', onChange: () => {} }))
    expect(markup.match(/class="otp-box[ "]/g)).toHaveLength(6)
    expect(markup.match(/<input/g)).toHaveLength(1)
    expect(markup).toContain('autoComplete="one-time-code"')
  })
})
