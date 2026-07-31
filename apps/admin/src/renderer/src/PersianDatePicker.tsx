import { useMemo } from 'react'
import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

const monthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

export function parseIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return toJalaali(year!, month!, day!)
}

export function isoDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export function PersianDatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const selected = parseIso(value)
  const years = useMemo(
    () => Array.from({ length: 11 }, (_, index) => selected.jy - 5 + index),
    [selected.jy],
  )
  const setDate = (year: number, month: number, day: number) => {
    const safeDay = Math.min(day, jalaaliMonthLength(year, month))
    const gregorian = toGregorian(year, month, safeDay)
    onChange(isoDate(gregorian.gy, gregorian.gm, gregorian.gd))
  }

  return <div className="persian-date-picker" role="group" aria-label="تاریخ">
    <select
      aria-label="روز"
      value={selected.jd}
      onChange={(event) => setDate(selected.jy, selected.jm, Number(event.target.value))}
    >
      {Array.from({ length: jalaaliMonthLength(selected.jy, selected.jm) }, (_, index) => index + 1)
        .map((day) => <option value={day} key={day}>{day}</option>)}
    </select>
    <select
      aria-label="ماه"
      value={selected.jm}
      onChange={(event) => setDate(selected.jy, Number(event.target.value), selected.jd)}
    >
      {monthNames.map((name, index) => <option value={index + 1} key={name}>{name}</option>)}
    </select>
    <select
      aria-label="سال"
      value={selected.jy}
      onChange={(event) => setDate(Number(event.target.value), selected.jm, selected.jd)}
    >
      {years.map((year) => <option value={year} key={year}>{year}</option>)}
    </select>
  </div>
}
