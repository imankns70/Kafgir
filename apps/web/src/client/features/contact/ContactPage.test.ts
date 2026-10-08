import { describe, expect, it } from 'vitest'
import { formatConversationTime, subjectIcon } from './ContactPage'

describe('contact page helpers', () => {
  it('picks a subject icon from the admin-written title', () => {
    expect(subjectIcon('پیگیری سفارش')).toBe('orders')
    expect(subjectIcon('ارسال و تحویل')).toBe('delivery')
    expect(subjectIcon('کیفیت غذا')).toBe('food')
    expect(subjectIcon('سایر موارد')).toBe('support')
  })

  it('reads conversation times like a chat list, in Tehran time', () => {
    const now = new Date('2026-10-08T10:00:00.000Z') // 13:30 in Tehran
    expect(formatConversationTime('2026-10-08T07:00:00.000Z', now)).toBe('10:30')
    expect(formatConversationTime('2026-10-07T07:00:00.000Z', now)).toBe('دیروز')
    expect(formatConversationTime('2026-10-01T07:00:00.000Z', now)).toContain('مهر')
  })
})
