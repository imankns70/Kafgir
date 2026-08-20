/**
 * Money in server-generated text — a settlement refusal, a Telegram invoice, an operator
 * notification.
 *
 * The rules themselves live in `@kafgir/contracts` so that a figure the server quotes back reads
 * exactly like the same figure on the screen next to it. This module only re-exports them, keeping
 * the existing `formatToman` name that call sites here already use.
 */
export { formatAmount, formatMoney as formatToman, parseMoney } from '@kafgir/contracts'
