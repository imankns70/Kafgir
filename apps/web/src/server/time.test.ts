import { describe, expect, it } from 'vitest'
import { businessDate, isIsoDate, persianBusinessYear } from './time'

describe('Iran business time', () => {
  it('uses the Tehran calendar date around UTC midnight', () => {
    expect(businessDate(new Date('2026-07-27T21:00:00.000Z'))).toBe('2026-07-28')
  })

  it('uses the Persian year for order numbering', () => {
    expect(persianBusinessYear(new Date('2026-07-28T12:00:00.000Z'))).toBe(1405)
  })

  it('accepts an ISO date', () => {
    expect(isIsoDate('2026-07-28')).toBe(true)
  })

  it.each(['2026-7-28', 'not-a-date', '2026-13-40'])('rejects invalid date %s', (value) => {
    expect(isIsoDate(value)).toBe(false)
  })
})
