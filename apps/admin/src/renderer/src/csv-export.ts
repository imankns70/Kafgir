import { maxPageSize, type PagedResult } from '@kafgir/contracts'

/**
 * Export a grid as CSV that Excel opens correctly: UTF-8 with a byte-order mark (without it Excel
 * reads Persian as mojibake), CRLF line ends, and every field quoted.
 */

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined }

const quote = (value: string | number | null | undefined) => {
  let text = value == null ? '' : String(value)
  // Customer-typed text that starts like a formula would run as one in Excel; neutralise it.
  if (typeof value === 'string' && /^[=+\-@\t\r]/u.test(text)) text = `'${text}`
  return `"${text.replace(/"/gu, '""')}"`
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => quote(column.header)).join(',')]
  for (const row of rows) lines.push(columns.map((column) => quote(column.value(row))).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** Every page of a server-paged list, for exporting what a filter matched rather than one screen. */
export async function fetchAllPages<T>(fetchPage: (page: number, pageSize: number) => Promise<PagedResult<T>>, limit = 20_000): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await fetchPage(page, maxPageSize)
    items.push(...result.items)
    if (page >= result.totalPages || result.items.length === 0 || items.length >= limit) return items
  }
}
