import { describe, expect, it } from 'vitest'
import { clampTime, formatTime, hourOptions, minuteOptions, parseTime } from './persian-time'

describe('parseTime', () => {
  it('reads a 24-hour value', () => {
    expect(parseTime('14:05')).toEqual({ hour: 14, minute: 5 })
    expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 })
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 })
  })

  it('accepts a single-digit hour, which PostgreSQL time values can produce', () => {
    expect(parseTime('9:30')).toEqual({ hour: 9, minute: 30 })
  })

  it('rejects an empty or malformed value', () => {
    expect(parseTime(null)).toBeNull()
    expect(parseTime('')).toBeNull()
    expect(parseTime('14')).toBeNull()
    expect(parseTime('14:5')).toBeNull()
    expect(parseTime('2:00 PM')).toBeNull()
  })

  it('rejects times outside a real clock', () => {
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
    expect(parseTime('-1:00')).toBeNull()
  })
})

describe('formatTime', () => {
  it('zero-pads both halves so the value matches the stored contract', () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe('09:05')
    expect(formatTime({ hour: 0, minute: 0 })).toBe('00:00')
    expect(formatTime({ hour: 23, minute: 59 })).toBe('23:59')
  })

  it('round-trips through parseTime', () => {
    for (const value of ['00:00', '07:30', '12:00', '18:45', '23:55']) {
      expect(formatTime(parseTime(value)!)).toBe(value)
    }
  })

  it('produces values the shared timeOfDay contract accepts', () => {
    const contract = /^([01]\d|2[0-3]):[0-5]\d$/u
    for (const hour of hourOptions()) {
      for (const minute of minuteOptions()) {
        expect(formatTime({ hour, minute })).toMatch(contract)
      }
    }
  })
})

describe('options', () => {
  it('offers a full 24-hour day, not a 12-hour clock', () => {
    expect(hourOptions()).toHaveLength(24)
    expect(hourOptions()[0]).toBe(0)
    expect(hourOptions().at(-1)).toBe(23)
  })

  it('steps minutes by five', () => {
    expect(minuteOptions()).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  })

  it('keeps an off-step minute so opening the picker cannot silently round it', () => {
    // A window stored as 12:07 by an earlier native input must survive being viewed.
    expect(minuteOptions(7)).toContain(7)
    expect(minuteOptions(7)).toHaveLength(13)
    expect(minuteOptions(7)).toEqual([...minuteOptions(7)].sort((a, b) => a - b))
  })

  it('does not duplicate a minute that is already on the step', () => {
    expect(minuteOptions(30)).toHaveLength(12)
  })
})

describe('clampTime', () => {
  it('pulls out-of-range values back onto the clock', () => {
    expect(clampTime({ hour: 30, minute: 90 })).toEqual({ hour: 23, minute: 59 })
    expect(clampTime({ hour: -5, minute: -1 })).toEqual({ hour: 0, minute: 0 })
  })

  it('leaves a valid time untouched', () => {
    expect(clampTime({ hour: 14, minute: 30 })).toEqual({ hour: 14, minute: 30 })
  })
})
