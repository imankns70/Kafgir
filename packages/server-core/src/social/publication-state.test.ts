import { describe, expect, it } from 'vitest'
import { aggregateSocialPostStatus } from './publication-state.js'

describe('aggregateSocialPostStatus', () => {
  it('keeps a post publishing while any target is pending', () => {
    expect(aggregateSocialPostStatus({ published: 1, failed: 1, pending: 1 })).toBe('Publishing')
  })

  it('marks all-success publication as published', () => {
    expect(aggregateSocialPostStatus({ published: 3, failed: 0, pending: 0 })).toBe('Published')
  })

  it('preserves partial failure instead of resending successful targets', () => {
    expect(aggregateSocialPostStatus({ published: 2, failed: 1, pending: 0 })).toBe('PartiallyFailed')
  })

  it('marks a publication failed when no destination succeeded', () => {
    expect(aggregateSocialPostStatus({ published: 0, failed: 2, pending: 0 })).toBe('Failed')
  })
})
