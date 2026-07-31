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

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}
