import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'

/**
 * Order numbers are `<Persian year>-<six random digits>`, for example `1405-482917`.
 *
 * They used to be the year followed by a running counter, which told any customer how many orders
 * Kafgir had taken: two receipts a week apart gave away the week's volume. A random suffix carries no
 * order and no count. It stays numeric so it is easy to read out over the phone, and the dash keeps it
 * from ever matching an old counter-style number such as `14051`.
 */
export const orderNumberPattern = /^\d{4}-\d{6}$/

/** A six-digit suffix that never starts with zero, so every number has the same length. */
export const randomOrderSuffix = () => randomInt(100_000, 1_000_000)

export const formatOrderNumber = (year: string | number, suffix: number) => `${year}-${suffix}`

const maxAttempts = 25

/**
 * Picks an unused number for `year`. The caller holds the year's advisory lock, so no concurrent
 * checkout can take the same candidate between the check and the insert; the unique index on
 * `orders.order_number` is the backstop. With 900,000 suffixes a year, a retry is rare.
 */
export async function generateOrderNumber(
  tx: TransactionSql<Record<string, unknown>>,
  year: string,
  nextSuffix: () => number = randomOrderSuffix,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = formatOrderNumber(year, nextSuffix())
    const taken = await tx<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM orders WHERE order_number = ${candidate}) AS exists
    `
    if (!taken[0]?.exists) return candidate
  }
  throw new Error(`No free order number for ${year} after ${maxAttempts} attempts.`)
}

/**
 * The digits an operator typed to find an order, for matching against the order number's digits.
 * Persian and Arabic-Indic digits become Latin and everything else (the dash, `#`, spaces) is
 * dropped, so `۱۴۰۵-۴۸۲۹۱۷`, `1405482917` and `482917` all find `1405-482917`. Null when nothing
 * searchable remains.
 */
export function orderNumberSearchDigits(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '')
  return digits || null
}
