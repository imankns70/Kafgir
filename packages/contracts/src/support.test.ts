import { describe, expect, it } from 'vitest'
import {
  customerSupportConversationCreateSchema,
  supportMessageWriteSchema,
} from './support.js'

describe('private support contracts', () => {
  it('accepts a private message with an optional linked order', () => {
    expect(customerSupportConversationCreateSchema.parse({
      subject: 1,
      orderId: 42,
      message: 'لطفاً وضعیت سفارش را بررسی کنید.',
    })).toEqual({
      subject: 1,
      orderId: 42,
      message: 'لطفاً وضعیت سفارش را بررسی کنید.',
    })
  })

  it('accepts a database-defined subject identifier instead of a closed enum', () => {
    expect(customerSupportConversationCreateSchema.parse({ subject: 27, message: 'موضوع سفارشی' }).subject).toBe(27)
  })

  it('rejects empty and oversized messages', () => {
    expect(() => supportMessageWriteSchema.parse({ message: ' ' })).toThrow(/حداقل/u)
    expect(() => supportMessageWriteSchema.parse({ message: 'م'.repeat(2001) })).toThrow(/۲۰۰۰/u)
  })
})
