import { describe, expect, it } from 'vitest'
import { formatAmount, formatToman } from './money'
import { settlementRejection } from './courier-rules'

const persianDigits = /[۰-۹]/u

describe('money in server-generated text', () => {
  it('groups thousands the way both apps print prices', () => {
    expect(formatAmount(70_000)).toBe('70,000')
    expect(formatAmount(1_260_000)).toBe('1,260,000')
    expect(formatToman(560_000)).toBe('560,000 تومان')
  })

  it('keeps Latin digits so a figure matches the UI beside it', () => {
    expect(formatToman(1_260_000)).not.toMatch(persianDigits)
  })

  it('does not print fractions of a Toman', () => {
    expect(formatAmount(70_000.4)).toBe('70,000')
  })

  it('writes the balance in a settlement refusal the same way', () => {
    expect(settlementRejection(600_000, 560_000)).toContain('560,000 تومان')
  })
})
