import { describe, expect, it } from 'vitest'
import { sanitizeLogEntry } from './read-logs'

describe('sanitizeLogEntry', () => {
  it('blanks SQL parameters, addresses and phone numbers at any depth, keeping the diagnosis', () => {
    const entry = sanitizeLogEntry({
      level: 50, event: 'order.failed', msg: 'ثبت سفارش ناموفق بود',
      err: { message: 'duplicate key', code: '23505', query: 'INSERT …', parameters: ['علی', '09121234567', 'خیابان یاس'] },
      context: { address: 'خیابان یاس', phone: '09121234567', orderId: 7 },
    }) as Record<string, any>
    expect(entry.err).toEqual({ message: 'duplicate key', code: '23505', query: '[REDACTED]', parameters: '[REDACTED]' })
    expect(entry.context).toEqual({ address: '[REDACTED]', phone: '[REDACTED]', orderId: 7 })
    expect(JSON.stringify(entry)).not.toContain('0912')
  })
})
