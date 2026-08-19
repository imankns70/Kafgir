/**
 * Time-of-day helpers for the admin picker.
 *
 * The stored value is 24-hour `HH:MM`, which is what `timeOfDay` in `@kafgir/contracts` validates and
 * what PostgreSQL `time` columns hold. The native `<input type="time">` renders a 12-hour AM/PM
 * spinner in this locale, so it disagrees with the stored convention as well as being English.
 *
 * Digits stay Latin, matching how dates, prices and phone numbers are already rendered in the admin.
 */

export type TimeOfDay = { hour: number; minute: number }

/** Minute granularity offered by default. Delivery windows and quiet hours land on these in practice. */
const minuteStep = 5

const pad = (value: number) => String(value).padStart(2, '0')

export const formatTime = ({ hour, minute }: TimeOfDay): string => `${pad(hour)}:${pad(minute)}`

/** `14:05` → `{ hour: 14, minute: 5 }`. Rejects anything outside a real 24-hour clock. */
export function parseTime(value: string | null | undefined): TimeOfDay | null {
  if (!value || !/^\d{1,2}:\d{2}$/u.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  if (hour == null || minute == null) return null
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export const hourOptions = (): number[] => Array.from({ length: 24 }, (_, index) => index)

/**
 * The selectable minutes.
 *
 * Stepping by five keeps the column short, but a value already stored off-step — from an earlier
 * native input, a seeded row or a migration — must still appear, or opening the picker on that row
 * and closing it again would silently round the time.
 */
export function minuteOptions(current: number | null = null): number[] {
  const steps = Array.from({ length: 60 / minuteStep }, (_, index) => index * minuteStep)
  if (current == null || steps.includes(current)) return steps
  return [...steps, current].sort((left, right) => left - right)
}

/** Clamps to a real clock value, used when a caller supplies a partial or out-of-range time. */
export const clampTime = ({ hour, minute }: TimeOfDay): TimeOfDay => ({
  hour: Math.min(23, Math.max(0, Math.trunc(hour))),
  minute: Math.min(59, Math.max(0, Math.trunc(minute))),
})
