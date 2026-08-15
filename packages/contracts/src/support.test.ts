import { describe, expect, it } from 'vitest'
import {
  SupportConversationSubject,
  customerSupportConversationCreateSchema,
  supportMessageWriteSchema,
} from './support.js'

describe('private support contracts', () => {
  it('accepts a private message with an optional linked order', () => {
    expect(customerSupportConversationCreateSchema.parse({
      subject: SupportConversationSubject.OrderFollowUp,
      orderId: 42,
      message: 'لطفاً وضعیت سفارش را بررسی کنید.',
    })).toEqual({
      subject: SupportConversationSubject.OrderFollowUp,
      orderId: 42,
      message: 'لطفاً وضعیت سفارش را بررسی کنید.',
    })
  })

  it('does not define collaboration as a customer subject', () => {
    expect(Object.values(SupportConversationSubject)).not.toContain('Collaboration')
  })

  it('rejects empty and oversized messages', () => {
    expect(() => supportMessageWriteSchema.parse({ message: ' ' })).toThrow(/حداقل/u)
    expect(() => supportMessageWriteSchema.parse({ message: 'م'.repeat(2001) })).toThrow(/۲۰۰۰/u)
  })
})
