import { describe, expect, it } from 'vitest'
import { normalizeIranianMobile } from './customer-phone'

describe('normalizeIranianMobile', () => {
  it.each([
    ['09121234567', '09121234567'],
    ['۰۹۱۲۱۲۳۴۵۶۷', '09121234567'],
    ['٠٩١٢١٢٣٤٥٦٧', '09121234567'],
    ['+98 912 123 4567', '09121234567'],
    ['0098-912-123-4567', '09121234567'],
    ['989121234567', '09121234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected)
  })

  it.each(['02112345678', '09123', 'not-a-phone'])('rejects %s', (input) => {
    expect(() => normalizeIranianMobile(input)).toThrow('شماره موبایل')
  })
})
