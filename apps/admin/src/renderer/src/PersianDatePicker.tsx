import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
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
  type JalaliDate,
} from './persian-calendar'

/**
 * A Jalali calendar picker.
 *
 * The native `<input type="date">` opens the browser's Gregorian calendar, which is unusable for an
 * operator who thinks in «۲۸ تیر». This renders the month grid in the Persian calendar instead, while
 * the value crossing `onChange` stays ISO Gregorian `YYYY-MM-DD` — every API contract and database
 * column speaks that, so the calendar is presentation only.
 *
 * The trigger is a button rather than a text input: a free-text Jalali field invites half-typed and
 * ambiguous input («۴/۵» is which?) that has to be parsed and rejected, and the operator gains
 * nothing over picking from a grid they can see.
 */
export function PersianDatePicker({ value, onChange, allowClear = false, id }: {
  /** ISO Gregorian `YYYY-MM-DD`, or an empty string for no selection. */
  value: string
  onChange: (value: string) => void
  /** Off by default: most fields drive a query that cannot run on an empty date. */
  allowClear?: boolean
  id?: string
}) {
  const selected = fromIsoDate(value)
  const [open, setOpen] = useState(false)
  // The month on screen, which the operator can page away from without changing the selection.
  const [view, setView] = useState<JalaliDate>(selected ?? todayJalali())
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Reopening should land on the selected date, not wherever the operator browsed to last time.
  useEffect(() => {
    if (open) setView(selected ?? todayJalali())
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const pick = (day: number) => {
    onChange(toIsoDate({ jy: view.jy, jm: view.jm, jd: day }))
    close()
  }

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  const today = todayJalali()
  const grid = monthGrid(view.jy, view.jm)
  const years = Array.from({ length: 21 }, (_, index) => today.jy - 10 + index)

  return <div className="persian-date-picker" ref={rootRef}>
    <button
      type="button"
      id={id}
      ref={triggerRef}
      className="persian-date-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      {selected ? formatJalali(selected) : 'انتخاب تاریخ'}
    </button>

    {open && <div
      className="persian-date-panel"
      role="dialog"
      aria-modal="false"
      aria-label="انتخاب تاریخ"
      onKeyDown={onPanelKeyDown}
    >
      <div className="persian-date-head">
        {/* In RTL the "previous" control sits on the right, so the arrows read outward from the middle. */}
        <button type="button" aria-label="ماه قبل" onClick={() => setView(shiftMonth(view, -1))}>›</button>
        <div className="persian-date-selects">
          <select aria-label="ماه" value={view.jm}
            onChange={(event) => setView(shiftMonth(view, Number(event.target.value) - view.jm))}>
            {persianMonths.map((name, index) =>
              <option value={index + 1} key={name}>{name}</option>)}
          </select>
          <select aria-label="سال" value={view.jy}
            onChange={(event) => {
              const year = Number(event.target.value)
              setView({ jy: year, jm: view.jm, jd: Math.min(view.jd, monthLength(year, view.jm)) })
            }}>
            {years.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" aria-label="ماه بعد" onClick={() => setView(shiftMonth(view, 1))}>‹</button>
      </div>

      <div className="persian-date-weekdays" aria-hidden="true">
        {persianWeekdays.map((day, index) => <span key={index}>{day}</span>)}
      </div>

      <div className="persian-date-grid" role="grid">
        {grid.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} className="persian-date-blank" />
          const cell: JalaliDate = { jy: view.jy, jm: view.jm, jd: day }
          const isSelected = isSameJalaliDate(cell, selected)
          const isToday = isSameJalaliDate(cell, today)
          return <button
            type="button"
            key={day}
            className={`persian-date-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
            aria-current={isSelected ? 'date' : undefined}
            aria-label={formatJalali(cell)}
            onClick={() => pick(day)}
          >{day}</button>
        })}
      </div>

      <div className="persian-date-actions">
        {allowClear && <button type="button" onClick={() => { onChange(''); close() }}>پاک کردن</button>}
        <button type="button" onClick={() => { onChange(toIsoDate(today)); close() }}>امروز</button>
      </div>
    </div>}
  </div>
}
