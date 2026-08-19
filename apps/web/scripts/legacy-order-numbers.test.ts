import { describe, expect, it } from 'vitest'
import { inspectLegacyOrderNumbers } from './legacy-order-numbers'

const reasons = (findings: Array<{ orderNumber: string; reason: string }>) =>
  findings.map((finding) => `${finding.orderNumber} ${finding.reason}`)

describe('legacy order number pre-flight', () => {
  it('accepts numbers that match the shape createOrder generates', () => {
    const report = inspectLegacyOrderNumbers(['14041', '140499', '1404100', '14051'])
    expect(report.blocking).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it('accepts numbers that carry no year prefix at all', () => {
    // A legacy scheme the counter simply never reads: `LIKE '<year>%'` does not match it.
    const report = inspectLegacyOrderNumbers(['INV-2024-0001', 'A-17', 'order/99'])
    expect(report.blocking).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it('blocks a suffix above the int4 limit, naming the failure it would cause', () => {
    const report = inspectLegacyOrderNumbers(['14049999999999'])
    expect(report.blocking).toHaveLength(1)
    expect(report.blocking[0]!.orderNumber).toBe('14049999999999')
    expect(report.blocking[0]!.reason).toContain('2147483647')
    expect(report.blocking[0]!.reason).toContain('value out of range for type integer')
  })

  it('accepts the largest suffix that still fits int4 and blocks the next one', () => {
    expect(inspectLegacyOrderNumbers(['14042147483647']).blocking).toEqual([])
    expect(inspectLegacyOrderNumbers(['14042147483648']).blocking).toHaveLength(1)
  })

  it('warns without blocking when a legal suffix would jump the counter', () => {
    const report = inspectLegacyOrderNumbers(['1404214093012'])
    expect(report.blocking).toEqual([])
    expect(report.warnings).toHaveLength(1)
    // The operator is told the number the next real order would receive.
    expect(report.warnings[0]!.reason).toContain('1404214093013')
  })

  it('predicts the successor the way the counter actually computes it, dropping zero padding', () => {
    // A zero-padded legacy suffix does not keep its padding: the counter reads it through
    // `substring(...)::int`, so '0214093012' becomes 214093012 and the next number is shorter than
    // the row that produced it. Surfacing the real successor is the point of the warning.
    const report = inspectLegacyOrderNumbers(['14040214093012'])
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.reason).toContain('would be 1404214093013')
  })

  it('blocks empty and missing order numbers', () => {
    const report = inspectLegacyOrderNumbers([null, undefined, '', '   '])
    expect(report.blocking).toHaveLength(4)
    for (const finding of report.blocking) expect(finding.reason).toContain('NOT NULL')
  })

  it('blocks values longer than the target column', () => {
    const report = inspectLegacyOrderNumbers(['X'.repeat(51)])
    expect(report.blocking).toHaveLength(1)
    expect(report.blocking[0]!.reason).toContain('varchar(50)')
  })

  it('accepts a value of exactly the column length', () => {
    expect(inspectLegacyOrderNumbers(['X'.repeat(50)]).blocking).toEqual([])
  })

  it('blocks duplicates, which the unique index would reject mid-copy', () => {
    const report = inspectLegacyOrderNumbers(['14041', '14042', '14041'])
    expect(report.blocking).toHaveLength(1)
    expect(report.blocking[0]!.orderNumber).toBe('14041')
    expect(report.blocking[0]!.reason).toContain('appears 2 times')
  })

  it('reports every distinct problem in one pass', () => {
    const report = inspectLegacyOrderNumbers([
      '14041',
      '14049999999999',
      '',
      'Y'.repeat(60),
    ])
    expect(report.blocking).toHaveLength(3)
    expect(reasons(report.blocking).join('\n')).toContain('int4 limit')
  })

  it('trims surrounding whitespace before judging a value', () => {
    expect(inspectLegacyOrderNumbers(['  14041  ']).blocking).toEqual([])
  })
})
