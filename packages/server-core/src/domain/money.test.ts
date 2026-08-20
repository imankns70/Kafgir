import { describe, expect, it } from 'vitest'
import { formatToman } from './money'
import { settlementRejection } from './courier-rules'

/**
 * The formatting rules are tested in `@kafgir/contracts`. What matters here is that server-generated
 * text really goes through them, so a figure the server quotes back matches the same figure on the
 * screen next to it — the settlement refusal used to print Persian digits while the grid beside it
 * printed Latin ones.
 */
describe('money in server-generated text', () => {
  it('uses the shared presentation', () => {
    expect(formatToman(560_000)).toBe('560,000 تومان')
  })

  it('writes the balance in a settlement refusal the same way', () => {
    expect(settlementRejection(600_000, 560_000)).toContain('560,000 تومان')
  })
})
