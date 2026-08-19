import { describe, expect, it } from 'vitest'
import {
  asciiDigits,
  customerSearchTerms,
  customerSortClause,
  customerSortColumns,
  normalizePersianName,
  splitPersonName,
} from './customer-search-rules'

describe('asciiDigits', () => {
  it('rewrites Persian digits', () => {
    expect(asciiDigits('۰۹۱۲۱۱۱۲۲۳۳')).toBe('09121112233')
  })

  it('rewrites Arabic-Indic digits', () => {
    expect(asciiDigits('٠٩١٢')).toBe('0912')
  })

  it('leaves letters and punctuation untouched', () => {
    expect(asciiDigits('فائزه ۲')).toBe('فائزه 2')
  })
})

describe('customerSearchTerms', () => {
  it('treats an empty search as no filter at all', () => {
    expect(customerSearchTerms(null)).toEqual({ name: null, phone: null })
    expect(customerSearchTerms('   ')).toEqual({ name: null, phone: null })
  })

  it('routes text to the name filter', () => {
    expect(customerSearchTerms('فائزه')).toEqual({ name: 'فائزه', phone: null })
  })

  it('routes digits to the phone filter', () => {
    expect(customerSearchTerms('09121112233')).toEqual({ name: null, phone: '9121112233' })
  })

  it('finds the same customer however the number was written', () => {
    const national = customerSearchTerms('09121112233').phone
    expect(customerSearchTerms('+989121112233').phone).toBe(national)
    expect(customerSearchTerms('00989121112233').phone).toBe(national)
    expect(customerSearchTerms('9121112233').phone).toBe(national)
  })

  it('accepts Persian digits in a phone search', () => {
    expect(customerSearchTerms('۰۹۱۲۱۱۱۲۲۳۳').phone).toBe('9121112233')
  })

  it('tolerates spaces and dashes operators paste in', () => {
    expect(customerSearchTerms('0912-111 2233').phone).toBe('9121112233')
  })

  it('supports a partial trailing search', () => {
    expect(customerSearchTerms('2233')).toEqual({ name: null, phone: '2233' })
  })

  it('ignores a digit run too short to narrow anything', () => {
    expect(customerSearchTerms('09')).toEqual({ name: null, phone: null })
  })

  it('treats a mixed term as a name so "خانه ۲" still matches', () => {
    expect(customerSearchTerms('خانه ۲')).toEqual({ name: 'خانه 2', phone: null })
  })
})

describe('normalizePersianName', () => {
  it('folds Arabic letters onto their Persian equivalents', () => {
    expect(normalizePersianName('فايزه')).toBe(normalizePersianName('فائزه'.replace('ئ', 'ی')))
    expect(normalizePersianName('يعقوبوند')).toBe('یعقوبوند')
    expect(normalizePersianName('ملك')).toBe('ملک')
  })

  it('makes the three spellings of a compound family name identical', () => {
    const spaced = normalizePersianName('علی پور')
    expect(normalizePersianName('علی‌پور')).toBe(spaced)
    expect(normalizePersianName('علیپور')).toBe(spaced)
  })

  it('ignores surrounding and repeated whitespace', () => {
    expect(normalizePersianName('  علی   پور ')).toBe('علیپور')
  })

  it('lowercases so a Latin-named customer matches either case', () => {
    expect(normalizePersianName('Ali')).toBe(normalizePersianName('ALI'))
  })
})

describe('splitPersonName', () => {
  it('splits a two-part name at the first space', () => {
    expect(splitPersonName('ایمان سلوکی')).toEqual({ firstName: 'ایمان', lastName: 'سلوکی' })
  })

  it('keeps a multi-word family name whole', () => {
    expect(splitPersonName('فائزه علی پور')).toEqual({ firstName: 'فائزه', lastName: 'علی پور' })
  })

  it('reports no family name for a single token', () => {
    // «محمدیار» is a real customer in this shape, so a family filter must simply not match them.
    expect(splitPersonName('محمدیار')).toEqual({ firstName: 'محمدیار', lastName: '' })
  })

  it('tolerates padding', () => {
    expect(splitPersonName('  ایمان   سلوکی  ')).toEqual({ firstName: 'ایمان', lastName: 'سلوکی' })
  })
})

describe('customerSortClause', () => {
  it('builds a deterministic clause for every sort key', () => {
    for (const key of Object.keys(customerSortColumns) as Array<keyof typeof customerSortColumns>) {
      // Paging is only stable if every sort has a unique tie-breaker.
      expect(customerSortClause(key)).toContain('"customerProfileId" ASC')
    }
  })

  it('puts customers who never ordered last when sorting by recency', () => {
    expect(customerSortClause('lastOrder')).toContain('NULLS LAST')
  })

  it('only ever emits whitelisted column fragments', () => {
    const clauses = Object.values(customerSortColumns).join(' ')
    expect(clauses).not.toMatch(/;|--|\bDROP\b|\bSELECT\b/iu)
  })
})
