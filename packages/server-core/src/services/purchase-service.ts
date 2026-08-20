import type { MonthPurchasesDto, PurchaseDto, PurchaseWriteRequest } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { NotFoundError } from '../errors'
import { jalaliMonthRange } from '../domain/jalali-month'
import { optionalText } from '../domain/order-rules'
import { logger } from '../logging/logger'

/**
 * Purchases: one line each, entered in seconds.
 *
 * Deliberately mutable. This is a kitchen notebook, not a ledger — correcting a mistyped amount
 * should be an edit, not a reversing entry. `audit_logs` keeps the trail, which is the proportionate
 * answer at this scale.
 */

type DbTimestamp = Date | string
const iso = (value: DbTimestamp) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

type PurchaseRow = Omit<PurchaseDto, 'createdAt' | 'updatedAt'> & {
  createdAt: DbTimestamp
  updatedAt: DbTimestamp | null
}

const dto = (row: PurchaseRow): PurchaseDto => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: row.updatedAt ? iso(row.updatedAt) : null,
})

const columns = sqlClient`
  id, purchase_date::text AS "purchaseDate", amount::float8 AS amount, title,
  seller_name AS "sellerName", receipt_image_url AS "receiptImageUrl", notes,
  created_at AS "createdAt", updated_at AS "updatedAt"
`

/** Everything bought in one Jalali month, newest first, with the month's total. */
export async function getMonthPurchases(year: number, month: number): Promise<MonthPurchasesDto> {
  const range = jalaliMonthRange(year, month)
  const rows = await sqlClient<PurchaseRow[]>`
    SELECT ${columns} FROM purchases
    WHERE purchase_date >= ${range.fromDate} AND purchase_date < ${range.toExclusiveDate}
    ORDER BY purchase_date DESC, id DESC
  `
  return {
    year: range.year,
    month: range.month,
    title: range.title,
    fromDate: range.fromDate,
    toDate: range.toDate,
    purchases: rows.map(dto),
    // Summed from the numbers, never from anything the UI formatted.
    totalAmount: rows.reduce((total, row) => total + row.amount, 0),
  }
}

async function audit(action: string, id: number, userId: number, details?: string) {
  await sqlClient`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES (${action}, 'purchase', ${id}, ${userId}, ${details ?? null}, NOW())
  `
  logger.info({ event: action, entityType: 'purchase', entityId: id, userId }, 'خرید ثبت شد')
}

export async function createPurchase(
  input: PurchaseWriteRequest,
  userId: number,
): Promise<PurchaseDto> {
  const rows = await sqlClient<PurchaseRow[]>`
    INSERT INTO purchases
      (purchase_date, amount, title, seller_name, receipt_image_url, notes, created_at)
    VALUES
      (${input.purchaseDate}, ${input.amount}, ${input.title}, ${optionalText(input.sellerName)},
       ${optionalText(input.receiptImageUrl)}, ${optionalText(input.notes)}, NOW())
    RETURNING ${columns}
  `
  const created = dto(rows[0]!)
  await audit('purchase.create', created.id, userId, String(created.amount))
  return created
}

export async function updatePurchase(
  id: number,
  input: PurchaseWriteRequest,
  userId: number,
): Promise<PurchaseDto> {
  const rows = await sqlClient<PurchaseRow[]>`
    UPDATE purchases
    SET purchase_date = ${input.purchaseDate}, amount = ${input.amount}, title = ${input.title},
        seller_name = ${optionalText(input.sellerName)},
        receipt_image_url = ${optionalText(input.receiptImageUrl)},
        notes = ${optionalText(input.notes)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING ${columns}
  `
  if (!rows[0]) throw new NotFoundError('خرید پیدا نشد.')
  const updated = dto(rows[0])
  await audit('purchase.update', id, userId, String(updated.amount))
  return updated
}

/**
 * Removes a purchase outright. Nothing is derived from it beyond a monthly sum, so there is no
 * reversal to write — the audit row is what records that it once existed.
 */
export async function deletePurchase(id: number, userId: number): Promise<void> {
  const rows = await sqlClient<{ amount: number; title: string }[]>`
    DELETE FROM purchases WHERE id = ${id} RETURNING amount::float8 AS amount, title
  `
  if (!rows[0]) throw new NotFoundError('خرید پیدا نشد.')
  await audit('purchase.delete', id, userId, `${rows[0].title} — ${rows[0].amount}`)
}
