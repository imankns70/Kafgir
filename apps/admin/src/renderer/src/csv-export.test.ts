import { describe, expect, it } from 'vitest'
import { fetchAllPages, toCsv } from './csv-export'

describe('toCsv', () => {
  it('starts with a byte-order mark, quotes every field and escapes quotes', () => {
    const csv = toCsv([{ name: 'قورمه "ویژه"', amount: 1200 }], [
      { header: 'نام', value: (row) => row.name },
      { header: 'مبلغ', value: (row) => row.amount },
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('﻿"نام","مبلغ"\r\n"قورمه ""ویژه""","1200"\r\n')
  })

  it('defuses customer text that Excel would run as a formula, but not negative numbers', () => {
    const csv = toCsv([{ name: '=HYPERLINK("x")', amount: -500 }], [
      { header: 'نام', value: (row) => row.name },
      { header: 'مبلغ', value: (row) => row.amount },
    ])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('"-500"')
  })
})

describe('fetchAllPages', () => {
  it('walks every page the server reports', async () => {
    const pages = [[1, 2], [3]]
    const items = await fetchAllPages(async (page) => ({
      items: pages[page - 1] ?? [], page, pageSize: 2, totalItems: 3, totalPages: 2,
    }))
    expect(items).toEqual([1, 2, 3])
  })
})
