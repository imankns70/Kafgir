/**
 * Money, written and read back.
 *
 * Kafgir speaks Toman, and a Toman has no smaller unit anyone quotes — prices, delivery fees,
 * courier payables and settlements are whole numbers. So money is an integer everywhere it is
 * stored, sent over an API or calculated with, and these helpers exist only at the two edges where
 * it meets a person: printing a figure, and reading one that was typed.
 *
 * This lives in `contracts` because all three consumers need the identical answer — the customer
 * web app, Electron Admin, and the server text that quotes an amount back (a settlement refusal, a
 * Telegram invoice). Four separate copies had already drifted: the same amount printed as «۵۶۰٬۰۰۰»
 * on one screen and «560,000» on the next, and one parser turned «abc» into 0.
 *
 * Nothing here ever takes part in a calculation. Format at the moment of display, parse at the
 * moment of input, and keep numbers in between.
 */

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** «1,260,000» — a grouped amount with no unit, for sentences and cells that supply their own. */
export const formatAmount = (value: number): string =>
  Number.isFinite(value) ? grouped.format(value) : ''

/** «1,260,000 تومان» — the standalone figure a customer or operator reads. */
export const formatMoney = (value: number): string => `${formatAmount(value)} تومان`

/**
 * Digits an operator or customer may actually type, reduced to Latin, with grouping removed.
 *
 * Persian (۰-۹) and Arabic-Indic (٠-٩) keyboards are both in use, and a figure pasted back out of
 * the UI arrives grouped — with a Latin comma, a Persian comma, or the Arabic thousands separator.
 * Bidi control characters ride along on copied RTL text and would otherwise poison `Number`.
 */
export const normalizeMoneyText = (value: string): string =>
  value
    .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[,،٬‎‏‪-‮⁦-⁩\s]/gu, '')
    .trim()

/**
 * Reads a typed amount, or null when it is not one.
 *
 * Null covers two different situations the caller must tell apart from a value: an empty box, which
 * means "not filled in" and must never become a free delivery, and unusable text, which must be
 * refused rather than quietly counted as zero.
 *
 * Fractions are rejected on purpose. A fractional Toman is not a thing anyone charges, and letting
 * one through is how a rounding difference ends up in a courier's balance.
 */
export const parseMoney = (value: string): number | null => {
  const normalized = normalizeMoneyText(value)
  // An explicit digits-only test rather than trusting `Number`, which happily accepts '0x10',
  // '1e3', 'Infinity' and '' — none of which is an amount somebody meant to type.
  if (!/^\d+$/u.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** True when a box holds something other than a usable amount, ignoring the empty case. */
export const isInvalidMoneyText = (value: string): boolean =>
  value.trim() !== '' && parseMoney(value) === null

/**
 * What a money box shows when it is not being edited. Null renders empty, so an unset fee stays
 * visibly unset instead of reading as a deliberate zero.
 */
export const moneyInputText = (value: number | null | undefined): string =>
  value == null ? '' : formatAmount(value)
