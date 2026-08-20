/**
 * How an amount is written when the server puts one into text a person reads — an error message, a
 * Telegram invoice, an operator notification.
 *
 * One helper rather than a `toLocaleString` at each call site, because those had already drifted:
 * the same amount appeared as «۵۶۰٬۰۰۰» in one message and «560,000» in another. Latin digits with
 * comma grouping is the convention both apps already print prices in, so text the server generates
 * matches what the UI shows beside it.
 *
 * This is presentation only. Amounts stay numeric everywhere they are stored or calculated, and
 * nothing ever parses these strings back.
 */

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** «560,000» — a bare grouped amount, for sentences that supply their own unit. */
export const formatAmount = (value: number): string => grouped.format(value)

/** «560,000 تومان» — the unit included, for standalone figures. */
export const formatToman = (value: number): string => `${formatAmount(value)} تومان`
