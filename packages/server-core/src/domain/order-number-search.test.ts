import { describe, expect, it } from 'vitest'
import { orderNumberSearchDigits } from './order-number'

describe('order number search', () => {
  it('reduces any typing of an order number to its Latin digits', () => {
    expect(orderNumberSearchDigits('1405-482917')).toBe('1405482917')
    expect(orderNumberSearchDigits('۱۴۰۵-۴۸۲۹۱۷')).toBe('1405482917')
    expect(orderNumberSearchDigits('٤٨٢٩١٧')).toBe('482917')
    expect(orderNumberSearchDigits(' #1405 482917 ')).toBe('1405482917')
  })

  it('still finds old counter-style numbers', () => {
    expect(orderNumberSearchDigits('14051')).toBe('14051')
  })

  it('treats text with no digits as no number at all', () => {
    expect(orderNumberSearchDigits('علی')).toBeNull()
    expect(orderNumberSearchDigits('')).toBeNull()
    expect(orderNumberSearchDigits(null)).toBeNull()
  })
})
