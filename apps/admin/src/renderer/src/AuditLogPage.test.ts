import { describe, expect, it } from 'vitest'
import { describeAuditDetails } from './AuditLogPage'

describe('describeAuditDetails', () => {
  it('names the order statuses an operator moved between', () => {
    expect(describeAuditDetails({ action: 'order.status', details: '3→6 — مشتری منصرف شد' }))
      .toBe('در حال آماده‌سازی ← لغوشده — مشتری منصرف شد')
  })
  it('leaves other actions as written', () => {
    expect(describeAuditDetails({ action: 'payment.refund', details: '50000 — سرد رسید' })).toBe('50000 — سرد رسید')
    expect(describeAuditDetails({ action: 'payment.create', details: null })).toBe('—')
  })
})
