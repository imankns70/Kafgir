import { readFile } from 'node:fs/promises'
import { serverLogFile } from './logger'

export interface LogEntry {
  time: number
  level: number
  service?: string
  event?: string
  msg?: string
  errorMessage?: string
  [key: string]: unknown
}

const personalKey = /^(parameters|query|args|address|addressLine|phone|phoneNumber|mobile|normalizedPhoneNumber|password|token)$/iu

/**
 * Removes anything personal a log line might still carry: lines written before a redaction rule
 * existed are read back through this too, so the Admin log page never shows them.
 */
export function sanitizeLogEntry(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitizeLogEntry(item, depth + 1))
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, personalKey.test(key) ? '[REDACTED]' : sanitizeLogEntry(item, depth + 1)]))
}

export async function readServerLogs(limit = 300): Promise<LogEntry[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 1000)
  try {
    const content = await readFile(serverLogFile, 'utf8')
    return content.trim().split(/\r?\n/u).slice(-safeLimit).reverse()
      .flatMap((line) => {
        try { return [sanitizeLogEntry(JSON.parse(line)) as LogEntry] } catch { return [] }
      })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
