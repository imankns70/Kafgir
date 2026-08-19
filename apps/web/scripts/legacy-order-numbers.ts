/**
 * Pre-flight rules for legacy `OrderNumber` values arriving from SQL Server.
 *
 * Kept in its own module because `migrate-sqlserver.ts` calls `main()` at import time — importing
 * that file to test these rules would start a real migration.
 *
 * The rules exist because `createOrder` picks the next order number as `MAX(numeric suffix) + 1`
 * over every row sharing the current Persian year prefix, and that query casts the suffix to `int`.
 * One migrated row with an oversized suffix therefore does not corrupt a number — it makes the
 * counter query throw, so *nobody can check out for the rest of that year*, with an error naming a
 * type rather than a row. These checks turn that into a legible failure before anything is written.
 */

/** `orders.order_number` is `varchar(50)`. */
export const orderNumberMaxLength = 50
/** The counter casts the suffix to `int`; anything larger aborts the query. */
export const int4Max = 2_147_483_647
/**
 * A suffix this large does not break anything, but it becomes the new high-water mark for its year,
 * so every later order number inherits the jump. Worth naming before a migration, not after.
 */
export const counterJumpThreshold = 1_000_000
/** `<four-digit year><digits>`: the exact shape the counter reads a suffix out of. */
const yearPrefixed = /^(\d{4})(\d+)$/u

export type OrderNumberFinding = { orderNumber: string; reason: string }
export type OrderNumberReport = { blocking: OrderNumberFinding[]; warnings: OrderNumberFinding[] }

export function inspectLegacyOrderNumbers(
  orderNumbers: Array<string | null | undefined>,
): OrderNumberReport {
  const blocking: OrderNumberFinding[] = []
  const warnings: OrderNumberFinding[] = []
  const seen = new Map<string, number>()

  for (const raw of orderNumbers) {
    const orderNumber = typeof raw === 'string' ? raw.trim() : ''
    if (!orderNumber) {
      blocking.push({ orderNumber: String(raw), reason: 'is empty; order_number is NOT NULL' })
      continue
    }
    if (orderNumber.length > orderNumberMaxLength) {
      blocking.push({
        orderNumber,
        reason: `is ${orderNumber.length} characters; order_number is varchar(${orderNumberMaxLength})`,
      })
      continue
    }
    seen.set(orderNumber, (seen.get(orderNumber) ?? 0) + 1)

    const match = yearPrefixed.exec(orderNumber)
    if (!match) continue
    const year = match[1]!
    const suffix = match[2]!
    // `Number` stays exact well past int4, so this comparison cannot itself overflow.
    const value = Number(suffix)
    if (value > int4Max) {
      blocking.push({
        orderNumber,
        reason: `has suffix ${suffix} after year ${year}, above the int4 limit ${int4Max}; ` +
          'order creation for that year would fail with "value out of range for type integer"',
      })
    } else if (value >= counterJumpThreshold) {
      warnings.push({
        orderNumber,
        reason: `has suffix ${suffix} after year ${year}; the next order of year ${year} would be ` +
          `${year}${value + 1}`,
      })
    }
  }

  for (const [orderNumber, count] of seen) {
    if (count > 1) {
      blocking.push({ orderNumber, reason: `appears ${count} times; order_number is unique` })
    }
  }
  return { blocking, warnings }
}

/** Renders a report as the message of a migration-blocking error, or `null` when it is clean. */
export function orderNumberPreflightError(report: OrderNumberReport): string | null {
  if (report.blocking.length === 0) return null
  const detail = report.blocking
    .slice(0, 10)
    .map((finding) => `  - "${finding.orderNumber}" ${finding.reason}`)
    .join('\n')
  const more = report.blocking.length > 10 ? `\n  …and ${report.blocking.length - 10} more.` : ''
  return `${report.blocking.length} legacy order number(s) cannot be migrated safely. ` +
    `Nothing has been written to the target database.\n${detail}${more}\n` +
    'Correct these in the source system, or renumber them, before re-running the migration.'
}
