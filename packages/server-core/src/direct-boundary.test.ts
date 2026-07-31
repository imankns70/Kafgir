import { describe, expect, it } from 'vitest'
import { normalizePhone, optionalText } from './domain/order-rules'

describe('shared server core', () => {
  it('keeps shared order normalization behavior available to both applications', () => {
    expect(normalizePhone(' 0912 123 4567 ')).toBe('09121234567')
    expect(optionalText('  یادداشت  ')).toBe('یادداشت')
  })
})
