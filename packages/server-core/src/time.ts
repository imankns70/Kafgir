const businessTimeZone = 'Asia/Tehran'

export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function persianBusinessYear(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: businessTimeZone,
    year: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  if (!Number.isInteger(year)) throw new Error('Could not determine Persian business year.')
  return year
}

/** Minutes past midnight in the business timezone. Delivery cutoffs compare against this, never
 *  against the server machine's clock or the browser's. */
export function businessMinutesOfDay(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: businessTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error('Could not determine business time of day.')
  }
  return hour * 60 + minute
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}
