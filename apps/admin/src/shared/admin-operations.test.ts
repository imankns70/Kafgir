import { describe, expect, it } from 'vitest'
import { adminOperations } from './admin-operations'

describe('Electron admin operation boundary', () => {
  it('contains unique allowlisted operation names', () => {
    expect(new Set(adminOperations).size).toBe(adminOperations.length)
  })

  it('does not expose raw database operations', () => {
    expect(adminOperations.some((name) => /sql|query|database\.execute/iu.test(name))).toBe(false)
  })
})
