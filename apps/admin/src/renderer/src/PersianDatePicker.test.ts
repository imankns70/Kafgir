import { describe, expect, it } from 'vitest'
import { isoDate, parseIso } from './PersianDatePicker'

describe('Persian date picker conversion', () => {
  it('converts the Gregorian API date to the Persian calendar', () => {
    expect(parseIso('2026-07-28')).toEqual({ jy: 1405, jm: 5, jd: 6 })
  })

  it('serializes Gregorian route dates with zero padding', () => {
    expect(isoDate(2026, 7, 8)).toBe('2026-07-08')
  })
})
