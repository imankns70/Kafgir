export type InvoicePrintLayout = 'a4' | 'thermal'

export type InvoicePrintRequest =
  | { layout: 'a4' }
  | { layout: 'thermal'; contentHeightPx: number }

const MICRONS_PER_CSS_PIXEL = 25_400 / 96
const THERMAL_VERTICAL_PADDING_MICRONS = 8_000
const MIN_THERMAL_HEIGHT_MICRONS = 80_000
const MAX_THERMAL_HEIGHT_MICRONS = 500_000

export function thermalPageHeightMicrons(contentHeightPx: number): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) {
    throw new Error('ارتفاع رسید حرارتی معتبر نیست.')
  }

  const measuredHeight = Math.ceil(
    contentHeightPx * MICRONS_PER_CSS_PIXEL + THERMAL_VERTICAL_PADDING_MICRONS,
  )
  return Math.min(MAX_THERMAL_HEIGHT_MICRONS, Math.max(MIN_THERMAL_HEIGHT_MICRONS, measuredHeight))
}

export function parseInvoicePrintRequest(value: unknown): InvoicePrintRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('درخواست چاپ معتبر نیست.')
  }

  const request = value as Record<string, unknown>
  if (request.layout === 'a4') return { layout: 'a4' }
  if (request.layout === 'thermal' && typeof request.contentHeightPx === 'number') {
    thermalPageHeightMicrons(request.contentHeightPx)
    return { layout: 'thermal', contentHeightPx: request.contentHeightPx }
  }
  throw new Error('نوع چاپ معتبر نیست.')
}
