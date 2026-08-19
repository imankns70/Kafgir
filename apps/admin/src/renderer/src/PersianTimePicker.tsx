import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatTime, hourOptions, minuteOptions, parseTime } from './persian-time'

/**
 * A 24-hour time picker.
 *
 * The native `<input type="time">` renders a 12-hour AM/PM spinner in this locale, which is both
 * English and a different clock from the one Kafgir stores: `timeOfDay` in `@kafgir/contracts` and
 * the PostgreSQL `time` columns are 24-hour `HH:MM`. Choosing «۲ PM» to mean `14:00` is an extra
 * translation step for the operator and an extra chance to record the wrong half of the day.
 *
 * Two columns rather than one long list of every minute: an operator picks the hour first and the
 * minute second, and 288 combined rows would be unusable.
 */
export function PersianTimePicker({ value, onChange, allowClear = false, id }: {
  /** 24-hour `HH:MM`, or an empty string for no selection. */
  value: string
  onChange: (value: string) => void
  /** Off by default: most times back a required field. */
  allowClear?: boolean
  id?: string
}) {
  const selected = parseTime(value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Both columns scroll; opening at 22:00 should not start the operator at midnight.
  useEffect(() => {
    if (!open) return
    for (const column of gridRef.current?.querySelectorAll('.persian-time-column') ?? []) {
      column.querySelector('.selected')?.scrollIntoView({ block: 'center' })
    }
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  /** Editing one column keeps the other; an unset time starts from the top of the hour. */
  const commit = (next: { hour?: number; minute?: number }) => {
    const base = selected ?? { hour: 0, minute: 0 }
    onChange(formatTime({ ...base, ...next }))
  }

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  return <div className="persian-time-picker" ref={rootRef}>
    <button
      type="button"
      id={id}
      ref={triggerRef}
      className="persian-time-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <bdi dir="ltr">{selected ? formatTime(selected) : 'انتخاب ساعت'}</bdi>
    </button>

    {open && <div
      className="persian-time-panel"
      role="dialog"
      aria-modal="false"
      aria-label="انتخاب ساعت"
      onKeyDown={onPanelKeyDown}
    >
      <div className="persian-time-grid" ref={gridRef}>
        <div className="persian-time-column" role="listbox" aria-label="ساعت">
          <span className="persian-time-heading">ساعت</span>
          {hourOptions().map((hour) => {
            const isSelected = selected?.hour === hour
            return <button
              type="button"
              key={hour}
              role="option"
              aria-selected={isSelected}
              className={isSelected ? 'selected' : ''}
              onClick={() => commit({ hour })}
            >{String(hour).padStart(2, '0')}</button>
          })}
        </div>
        <div className="persian-time-column" role="listbox" aria-label="دقیقه">
          <span className="persian-time-heading">دقیقه</span>
          {minuteOptions(selected?.minute ?? null).map((minute) => {
            const isSelected = selected?.minute === minute
            return <button
              type="button"
              key={minute}
              role="option"
              aria-selected={isSelected}
              className={isSelected ? 'selected' : ''}
              onClick={() => commit({ minute })}
            >{String(minute).padStart(2, '0')}</button>
          })}
        </div>
      </div>

      <div className="persian-time-actions">
        {allowClear && <button type="button" onClick={() => { onChange(''); close() }}>پاک کردن</button>}
        <button type="button" className="primary" onClick={close}>تأیید</button>
      </div>
    </div>}
  </div>
}
