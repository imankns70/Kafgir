import { describe, expect, it } from 'vitest'
import {
  formatAmount,
  formatMoney,
  isInvalidMoneyText,
  moneyInputText,
  normalizeMoneyText,
  parseMoney,
} from './money.js'

const persianDigits = /[۰-۹]/u

describe('formatting money', () => {
  it('groups thousands', () => {
    expect(formatAmount(0)).toBe('0')
    expect(formatAmount(1_000)).toBe('1,000')
    expect(formatAmount(70_000)).toBe('70,000')
    expect(formatAmount(1_260_000)).toBe('1,260,000')
    expect(formatAmount(560_000)).toBe('560,000')
  })

  it('shows a zero amount as a real figure, never as blank', () => {
    // A free delivery is «0 تومان»; an empty cell reads as "we forgot to say".
    expect(formatMoney(0)).toBe('0 تومان')
  })

  it('keeps the Toman unit and Latin digits', () => {
    expect(formatMoney(1_260_000)).toBe('1,260,000 تومان')
    expect(formatMoney(1_260_000)).not.toMatch(persianDigits)
  })
})

describe('parsing typed money', () => {
  it('reads plain and grouped Latin digits', () => {
    expect(parseMoney('70000')).toBe(70_000)
    expect(parseMoney('70,000')).toBe(70_000)
    expect(parseMoney('1,260,000')).toBe(1_260_000)
  })

  it('reads Persian digits, grouped or not', () => {
    expect(parseMoney('۱۲۰۰۰۰')).toBe(120_000)
    expect(parseMoney('۱۲۰,۰۰۰')).toBe(120_000)
    expect(parseMoney('۷۰٬۰۰۰')).toBe(70_000)
    expect(parseMoney('۱،۲۶۰،۰۰۰')).toBe(1_260_000)
  })

  it('still reads Arabic-Indic digits, which the app already accepted', () => {
    expect(parseMoney('٧٠٠٠٠')).toBe(70_000)
    expect(parseMoney('١٢٠,٠٠٠')).toBe(120_000)
  })

  it('ignores surrounding whitespace and copied bidi marks', () => {
    expect(parseMoney('  70,000  ')).toBe(70_000)
    expect(parseMoney('‎70,000‏')).toBe(70_000)
    expect(normalizeMoneyText(' ۷۰,۰۰۰ ')).toBe('70000')
  })

  it('treats an empty box as unset rather than zero', () => {
    // Clearing a delivery fee must not silently mean free delivery.
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
    expect(isInvalidMoneyText('')).toBe(false)
    expect(isInvalidMoneyText('   ')).toBe(false)
  })

  it('rejects garbage instead of converting it to zero', () => {
    for (const value of ['abc', '12abc', '-1', '1e5', '0x10', 'Infinity', 'NaN', '.', '−۵']) {
      expect(parseMoney(value)).toBeNull()
      expect(isInvalidMoneyText(value)).toBe(true)
    }
  })

  it('rejects fractions, because there is no sub-Toman amount to charge', () => {
    expect(parseMoney('70000.5')).toBeNull()
    expect(parseMoney('70,000.00')).toBeNull()
  })

  it('rejects a number too large to stay exact', () => {
    expect(parseMoney('9'.repeat(20))).toBeNull()
  })

  it('round-trips what the UI shows back to what it holds', () => {
    for (const amount of [0, 1_000, 70_000, 560_000, 1_260_000]) {
      expect(parseMoney(formatAmount(amount))).toBe(amount)
      expect(parseMoney(moneyInputText(amount))).toBe(amount)
    }
  })

  it('renders an unset amount as an empty box', () => {
    expect(moneyInputText(null)).toBe('')
    expect(moneyInputText(undefined)).toBe('')
    expect(moneyInputText(0)).toBe('0')
  })
})

/**
 * The money control formats on blur rather than on every keystroke, so a controlled input never has
 * its value rewritten under the caret. This walks that lifecycle without a DOM.
 */
describe('the money-box lifecycle', () => {
  const focus = (held: string) => normalizeMoneyText(held)
  const blur = (held: string) => {
    const parsed = parseMoney(held)
    return parsed === null ? held : moneyInputText(parsed)
  }

  it('leaves the text alone while typing and groups it on blur', () => {
    let held = ''
    for (const key of '1260000') held += key
    expect(held).toBe('1260000')
    expect(blur(held)).toBe('1,260,000')
  })

  it('strips separators on focus so an existing amount is easy to edit', () => {
    expect(focus('1,260,000')).toBe('1260000')
  })

  it('keeps unusable text visible instead of blanking or zeroing it', () => {
    expect(blur('abc')).toBe('abc')
  })

  it('survives repeated focus and blur without drifting', () => {
    let held = '۷۰٬۰۰۰'
    for (let round = 0; round < 3; round += 1) held = blur(focus(held))
    expect(held).toBe('70,000')
    expect(parseMoney(held)).toBe(70_000)
  })
})
