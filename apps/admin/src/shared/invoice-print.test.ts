import { describe, expect, it } from 'vitest'
import { parseInvoicePrintRequest, thermalPageHeightMicrons } from './invoice-print'

describe('invoice print request', () => {
  it('keeps short thermal receipts long enough for reliable paper cutting', () => {
    expect(thermalPageHeightMicrons(100)).toBe(80_000)
  })

  it('converts measured CSS pixels to a bounded thermal page height', () => {
    expect(thermalPageHeightMicrons(800)).toBe(219_667)
    expect(thermalPageHeightMicrons(10_000)).toBe(500_000)
  })

  it('rejects malformed thermal requests at the IPC boundary', () => {
    expect(() => parseInvoicePrintRequest({ layout: 'thermal', contentHeightPx: 0 })).toThrow()
    expect(() => parseInvoicePrintRequest({ layout: 'unknown' })).toThrow()
    expect(parseInvoicePrintRequest({ layout: 'a4', contentHeightPx: 12 })).toEqual({ layout: 'a4' })
  })
})
