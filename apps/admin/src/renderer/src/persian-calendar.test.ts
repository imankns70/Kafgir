import { describe, expect, it } from 'vitest'
import {
  firstWeekdayOffset,
  formatJalali,
  fromIsoDate,
  isSameJalaliDate,
  monthGrid,
  monthLength,
  persianMonths,
  persianWeekdays,
  shiftMonth,
  toIsoDate,
  todayJalali,
} from './persian-calendar'

describe('ISO to Jalali conversion', () => {
  it('round-trips a known date both ways', () => {
    expect(fromIsoDate('2026-07-19')).toEqual({ jy: 1405, jm: 4, jd: 28 })
    expect(toIsoDate({ jy: 1405, jm: 4, jd: 28 })).toBe('2026-07-19')
  })

  it('zero-pads the ISO output', () => {
    expect(toIsoDate({ jy: 1404, jm: 10, jd: 11 })).toBe('2026-01-01')
  })

  it('round-trips every day of a full Jalali year', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= monthLength(1405, month); day += 1) {
        const source = { jy: 1405, jm: month, jd: day }
        expect(fromIsoDate(toIsoDate(source))).toEqual(source)
      }
    }
  })

  it('rejects anything that is not a usable ISO date', () => {
    expect(fromIsoDate(null)).toBeNull()
    expect(fromIsoDate('')).toBeNull()
    expect(fromIsoDate('2026-7-9')).toBeNull()
    expect(fromIsoDate('not-a-date')).toBeNull()
    // A date the calendar does not have; `toJalaali` would silently convert it.
    expect(fromIsoDate('2026-02-31')).toBeNull()
  })
})

describe('month length', () => {
  it('gives the first six months 31 days and the next five 30', () => {
    expect(monthLength(1405, 1)).toBe(31)
    expect(monthLength(1405, 6)).toBe(31)
    expect(monthLength(1405, 7)).toBe(30)
    expect(monthLength(1405, 11)).toBe(30)
  })

  it('reports Esfand as 29 days in a common year and 30 in a leap year', () => {
    expect(monthLength(1405, 12)).toBe(29)
    expect(monthLength(1403, 12)).toBe(30)
  })
})

describe('month grid', () => {
  it('starts the week on Saturday', () => {
    expect(persianWeekdays[0]).toBe('ش')
    expect(persianWeekdays).toHaveLength(7)
  })

  it('pads the first row so day one lands in its weekday column', () => {
    const offset = firstWeekdayOffset(1405, 1)
    const grid = monthGrid(1405, 1)
    expect(grid.slice(0, offset).every((cell) => cell === null)).toBe(true)
    expect(grid[offset]).toBe(1)
  })

  it('holds exactly one cell per day after the padding', () => {
    for (let month = 1; month <= 12; month += 1) {
      const grid = monthGrid(1405, month)
      const days = grid.filter((cell): cell is number => cell !== null)
      expect(days).toHaveLength(monthLength(1405, month))
      expect(days[0]).toBe(1)
      expect(days.at(-1)).toBe(monthLength(1405, month))
    }
  })

  it('keeps the offset inside a single week', () => {
    for (let month = 1; month <= 12; month += 1) {
      const offset = firstWeekdayOffset(1405, month)
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset).toBeLessThan(7)
    }
  })

  it('places a day in the weekday column the real calendar puts it in', () => {
    // 1405/4/28 is 2026-07-19, a Sunday — Persian column 1, right after Saturday.
    const grid = monthGrid(1405, 4)
    expect(grid.indexOf(28) % 7).toBe(1)
  })
})

describe('month navigation', () => {
  it('steps forward and back within a year', () => {
    expect(shiftMonth({ jy: 1405, jm: 4, jd: 10 }, 1)).toEqual({ jy: 1405, jm: 5, jd: 10 })
    expect(shiftMonth({ jy: 1405, jm: 4, jd: 10 }, -1)).toEqual({ jy: 1405, jm: 3, jd: 10 })
  })

  it('rolls over the year boundary in both directions', () => {
    expect(shiftMonth({ jy: 1405, jm: 12, jd: 5 }, 1)).toEqual({ jy: 1406, jm: 1, jd: 5 })
    expect(shiftMonth({ jy: 1405, jm: 1, jd: 5 }, -1)).toEqual({ jy: 1404, jm: 12, jd: 5 })
  })

  it('clamps a day the target month does not have', () => {
    // 31 Farvardin has no counterpart in the 30-day months that follow.
    expect(shiftMonth({ jy: 1405, jm: 1, jd: 31 }, 6)).toEqual({ jy: 1405, jm: 7, jd: 30 })
    // Esfand 1405 is a 29-day month.
    expect(shiftMonth({ jy: 1405, jm: 1, jd: 31 }, 11)).toEqual({ jy: 1405, jm: 12, jd: 29 })
  })

  it('survives a twelve-month round trip', () => {
    const start = { jy: 1405, jm: 6, jd: 15 }
    expect(shiftMonth(shiftMonth(start, 12), -12)).toEqual(start)
  })
})

describe('helpers', () => {
  it('compares dates by value', () => {
    expect(isSameJalaliDate({ jy: 1405, jm: 4, jd: 28 }, { jy: 1405, jm: 4, jd: 28 })).toBe(true)
    expect(isSameJalaliDate({ jy: 1405, jm: 4, jd: 28 }, { jy: 1405, jm: 4, jd: 27 })).toBe(false)
    expect(isSameJalaliDate(null, { jy: 1405, jm: 4, jd: 28 })).toBe(false)
    expect(isSameJalaliDate(null, null)).toBe(false)
  })

  it('formats a date with its Persian month name', () => {
    expect(formatJalali({ jy: 1405, jm: 4, jd: 28 })).toBe('28 تیر 1405')
    expect(persianMonths).toHaveLength(12)
  })

  it('reads today in Tehran, not in the host timezone', () => {
    // 23:00 UTC is already the next day in Tehran (+03:30).
    const lateUtc = new Date('2026-07-19T23:00:00.000Z')
    expect(todayJalali(lateUtc)).toEqual({ jy: 1405, jm: 4, jd: 29 })
  })
})
