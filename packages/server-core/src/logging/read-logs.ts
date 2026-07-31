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

export async function readServerLogs(limit = 300): Promise<LogEntry[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 1000)
  try {
    const content = await readFile(serverLogFile, 'utf8')
    return content.trim().split(/\r?\n/u).slice(-safeLimit).reverse()
      .flatMap((line) => {
        try { return [JSON.parse(line) as LogEntry] } catch { return [] }
      })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
