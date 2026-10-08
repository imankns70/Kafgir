import { useState } from 'react'

export const OTP_LENGTH = 6

/** Keeps only the code's digits, accepting Persian and Arabic-Indic keyboards and pasted spacing. */
export const normalizeOtp = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/\D/g, '')
  .slice(0, OTP_LENGTH)

/**
 * Six boxes on screen, one real input underneath. A single input is what lets the phone offer the
 * code from the SMS (`one-time-code`) and lets a pasted code land whole; the boxes are only drawn.
 */
export function OtpCodeInput({ value, onChange, autoFocus = false, label = 'کد تایید' }: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  label?: string
}) {
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1)
  return <label className="field otp-field">{label}
    <span className="otp-boxes" dir="ltr">
      <input
        className="otp-native"
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(normalizeOtp(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // The boxes fill left to right, so the caret always stays after the last digit.
        onSelect={(event) => {
          const end = event.currentTarget.value.length
          event.currentTarget.setSelectionRange(end, end)
        }}
      />
      {Array.from({ length: OTP_LENGTH }, (_, index) =>
        <span
          key={index}
          aria-hidden="true"
          className={`otp-box${value[index] ? ' filled' : ''}${focused && index === activeIndex ? ' active' : ''}`}
        >{value[index] ?? ''}</span>)}
    </span>
  </label>
}
