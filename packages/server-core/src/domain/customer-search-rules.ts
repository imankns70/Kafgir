/**
 * Turning what an operator typed into something the customer query can match.
 *
 * Two problems this solves, both learned from how the search box is actually used:
 *
 * - Persian and Arabic-Indic digits. An operator copying a number out of a Telegram message gets
 *   `۰۹۱۲…`, which never matches the ASCII digits stored in `default_phone_number`.
 * - Partial phone numbers. People search the last four or five digits, or paste `+98912…`. Matching
 *   the raw string against the stored one fails for both, so the digits are extracted and matched as
 *   a suffix-friendly substring instead.
 */

const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'

/** Rewrites Persian/Arabic-Indic digits to ASCII, leaving everything else alone. */
export function asciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/gu, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String(arabicDigits.indexOf(digit)))
}

/**
 * Folds a Persian name to a form two spellings of the same person share.
 *
 * Three variations show up constantly in real customer data and each one breaks a plain `ILIKE`:
 *
 * - Arabic `ي`/`ك` typed instead of Persian `ی`/`ک`, usually from an Arabic keyboard layout.
 * - The zero-width non-joiner inside compound family names: «علی‌پور» versus «علی پور».
 * - An ordinary space in that same position, which is how most people actually type it.
 *
 * Whitespace is therefore removed rather than collapsed, so all three spellings of «علی پور» fold
 * to one string. `customer-directory-service` mirrors this exactly in SQL; the two must stay in
 * step or a name typed one way will silently fail to find a customer stored the other way.
 */
export function normalizePersianName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[يى]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/ة/gu, 'ه')
    .replace(/[\s‌‍]/gu, '')
}

/** Splits a stored full name the way the directory filters read it. */
export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const gap = trimmed.search(/\s/u)
  if (gap === -1) return { firstName: trimmed, lastName: '' }
  return { firstName: trimmed.slice(0, gap), lastName: trimmed.slice(gap).trim() }
}

export type CustomerSearchTerms = {
  /** Matched against the preferred name, or `null` when the operator clearly typed a number. */
  name: string | null
  /** Digits only, matched as a substring of the stored phone. `null` when there are too few. */
  phone: string | null
}

/** Below this, a digit run matches most of the customer base and is not a useful filter. */
const minimumPhoneDigits = 3

/**
 * Splits one search box into the two things it can mean.
 *
 * A term containing any letter is treated as a name; a term that is only digits and phone
 * punctuation is treated as a number. A leading `0`, `+98` or `0098` is stripped so the same
 * customer is found however their number was written down.
 */
export function customerSearchTerms(raw: string | null | undefined): CustomerSearchTerms {
  const value = asciiDigits((raw ?? '').trim())
  if (!value) return { name: null, phone: null }

  const digits = value.replace(/\D/gu, '')
  const looksNumeric = /^[\d\s()+\-.]+$/u.test(value)

  if (!looksNumeric) return { name: value, phone: null }
  if (digits.length < minimumPhoneDigits) return { name: null, phone: null }

  // `+989121112233`, `00989121112233`, `09121112233` and `9121112233` all reduce to the same core.
  const national = digits.startsWith('0098') ? digits.slice(4)
    : digits.startsWith('98') && digits.length >= 12 ? digits.slice(2)
    : digits.startsWith('0') ? digits.slice(1)
    : digits

  return { name: null, phone: national.length >= minimumPhoneDigits ? national : digits }
}

/** Whitelisted `ORDER BY` fragments. The sort key never reaches SQL as caller text. */
export const customerSortColumns = {
  lastOrder: '"lastOrderAt" DESC NULLS LAST',
  totalSpent: '"totalSpent" DESC',
  orderCount: '"orderCount" DESC',
  joined: '"joinedAt" DESC',
  name: '"preferredName" ASC',
} as const

export type CustomerSortKey = keyof typeof customerSortColumns

export function customerSortClause(sort: CustomerSortKey): string {
  // Profile id breaks ties so paging stays stable across requests.
  return `${customerSortColumns[sort]}, "customerProfileId" ASC`
}
