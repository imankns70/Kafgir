import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import pino, { type LoggerOptions } from 'pino'

const electronLogRoot = process.versions.electron && process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Kafgir Admin', 'logs')
  : null
const defaultLogDirectory = electronLogRoot
  ?? resolve(/* turbopackIgnore: true */ process.cwd(), '.data', 'logs')
const logDirectory = process.env.LOG_ROOT ? resolve(process.env.LOG_ROOT) : defaultLogDirectory
export const serverLogFile = resolve(logDirectory, 'server.jsonl')
const maxLogFileBytes = Number(process.env.LOG_MAX_FILE_BYTES ?? 5 * 1024 * 1024)

mkdirSync(logDirectory, { recursive: true })
if (existsSync(serverLogFile) && statSync(serverLogFile).size > maxLogFileBytes) {
  renameSync(serverLogFile, resolve(logDirectory, 'server.previous.jsonl'))
}

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    service: process.env.KAFGIR_SERVICE_NAME
      ?? (process.versions.electron ? 'kafgir-admin' : 'kafgir-web'),
    environment: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: [
      'password', '*.password', 'accessToken', '*.accessToken', 'authorization', '*.authorization',
      'headers.authorization', 'telegramInitData', '*.telegramInitData', 'DATABASE_URL',
      'connectionString', '*.connectionString', 'bytes', '*.bytes', 'receipt',
      'phoneNumber', '*.phoneNumber', 'normalizedPhoneNumber',
    ],
    censor: '[REDACTED]',
  },
  serializers: { err: pino.stdSerializers.err },
}

export const logger = pino(options, pino.multistream([
  { stream: process.stdout },
  { stream: pino.destination({ dest: serverLogFile, sync: false, mkdir: true }) },
]))

export function errorFields(error: unknown) {
  return error instanceof Error
    ? { err: error, errorName: error.name, errorMessage: error.message }
    : { errorMessage: String(error) }
}
