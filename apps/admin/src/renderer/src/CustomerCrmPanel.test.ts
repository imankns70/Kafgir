import { describe, expect, it } from 'vitest'
import { parseTags } from './CustomerCrmPanel'

describe('parseTags', () => {
  it('splits on Persian and Latin commas, trims and drops duplicates', () => {
    expect(parseTags(' وفادار، شرکتی ,وفادار,,  مشتری   ویژه ')).toEqual(['وفادار', 'شرکتی', 'مشتری ویژه'])
    expect(parseTags('   ')).toEqual([])
  })
})
