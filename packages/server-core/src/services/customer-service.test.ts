import { describe, expect, it } from 'vitest'
import { normalizeIranianMobile } from './customer-service'

describe('admin customer lookup phone normalization', () => {
  it.each([
    ['0912 123 4567', '09121234567'],
    ['+98 912 123 4567', '09121234567'],
    ['0098-912-123-4567', '09121234567'],
    ['۹۱۲۱۲۳۴۵۶۷', '09121234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected)
  })

  it('rejects an incomplete mobile number', () => {
    expect(() => normalizeIranianMobile('0912')).toThrow('شماره موبایل معتبر نیست')
  })
})
