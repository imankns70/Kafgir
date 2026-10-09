import { describe, expect, it } from 'vitest'
import { dishMarginText } from './BusinessPages'

describe('dishMarginText', () => {
  it('shows the margin in tomans and as a share of sales, or a dash without a cost', () => {
    expect(dishMarginText(1_000_000, 600_000)).toContain('(40٪)')
    expect(dishMarginText(1_000_000, null)).toBe('—')
    expect(dishMarginText(0, 100)).toBe('—')
  })
})
