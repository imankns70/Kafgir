import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pino, { type Logger } from 'pino'

let instance: Logger | null = null
let logFile = ''

export function desktopLogger() {
  if (instance) return instance
  const directory = app.getPath('logs')
  mkdirSync(directory, { recursive: true })
  logFile = join(directory, 'kafgir-admin.jsonl')
  if (existsSync(logFile) && statSync(logFile).size > 5 * 1024 * 1024) {
    renameSync(logFile, join(directory, 'kafgir-admin.previous.jsonl'))
  }
  instance = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'kafgir-admin', environment: app.isPackaged ? 'production' : 'development' },
    redact: {
      paths: ['password', '*.password', 'accessToken', '*.accessToken', 'authorization',
        '*.authorization', 'body.password', 'body.telegramInitData', 'bytes', '*.bytes'],
      censor: '[REDACTED]',
    },
    serializers: { err: pino.stdSerializers.err },
  }, pino.destination({ dest: logFile, sync: false, mkdir: true }))
  return instance
}

export function readDesktopLogs(limit = 300) {
  const safeLimit = Math.min(Math.max(limit, 1), 1000)
  if (!logFile) desktopLogger()
  try {
    return readFileSync(logFile, 'utf8').trim().split(/\r?\n/u).slice(-safeLimit).reverse()
      .flatMap((line) => {
        try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] }
      })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}
