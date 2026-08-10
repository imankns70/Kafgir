import { describe, expect, it } from 'vitest'
import { orderReviewWriteSchema } from './index.js'

describe('order review contract', () => {
  it('accepts one to five stars and an optional bounded comment', () => {
    expect(orderReviewWriteSchema.parse({ rating: 5, comment: 'عالی بود.' })).toEqual({ rating: 5, comment: 'عالی بود.' })
    expect(orderReviewWriteSchema.parse({ rating: 1, comment: null })).toEqual({ rating: 1, comment: null })
  })

  it('rejects ratings outside one to five and oversized comments', () => {
    expect(() => orderReviewWriteSchema.parse({ rating: 0 })).toThrow(/امتیاز/u)
    expect(() => orderReviewWriteSchema.parse({ rating: 6 })).toThrow(/امتیاز/u)
    expect(() => orderReviewWriteSchema.parse({ rating: 4, comment: 'الف'.repeat(1001) })).toThrow(/۱۰۰۰/u)
  })
})
