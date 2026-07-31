import { app, safeStorage } from 'electron'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type {
  ConnectionConfigurationStatus,
  SecureConnectionConfiguration,
} from '../shared/admin-operations'

const configurationFile = () => join(app.getPath('userData'), 'secure-connection.bin')

function developmentEnvironment(): Record<string, string> {
  if (app.isPackaged) return {}
  const candidates = [
    resolve(process.cwd(), '../web/.env.local'),
    resolve(process.cwd(), 'apps/web/.env.local'),
  ]
  for (const fileName of candidates) {
    try {
      return Object.fromEntries(readFileSync(fileName, 'utf8').split(/\r?\n/u).flatMap((line) => {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u)
        if (!match) return []
        return [[match[1]!, match[2]!.trim().replace(/^"(.*)"$/u, '$1')]]
      })) as Record<string, string>
    } catch {
      // Try the next workspace-relative location.
    }
  }
  return {}
}

function environmentConfiguration(): SecureConnectionConfiguration | null {
  const development = developmentEnvironment()
  const setting = (name: string) => (process.env[name] ?? development[name])?.trim()
  const databaseUrl = setting('DATABASE_URL')
  if (!databaseUrl) return null
  const endpoint = setting('LIARA_ENDPOINT')
  const bucket = setting('LIARA_BUCKET_NAME')
  const accessKeyId = setting('LIARA_ACCESS_KEY')
  const secretAccessKey = setting('LIARA_SECRET_KEY')
  const publicBaseUrl = setting('FOOD_MEDIA_PUBLIC_BASE')
  const value: SecureConnectionConfiguration = {
    databaseUrl,
    storage: endpoint && bucket && accessKeyId && secretAccessKey && publicBaseUrl
      ? { endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl }
      : null,
  }
  validateProductionDatabaseUrl(value.databaseUrl)
  validateStorage(value.storage)
  return value
}

function validateProductionDatabaseUrl(value: string) {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('آدرس پایگاه داده باید PostgreSQL باشد.')
  }
  if (app.isPackaged && url.searchParams.get('sslmode') !== 'require') {
    throw new Error('اتصال نسخه نصب‌شده باید دارای sslmode=require باشد.')
  }
}

function validateStorage(value: SecureConnectionConfiguration['storage']) {
  if (!value) return
  for (const candidate of [value.endpoint, value.publicBaseUrl]) {
    const url = new URL(candidate)
    if (url.protocol !== 'https:') {
      throw new Error('آدرس‌های فضای تصاویر باید HTTPS باشند.')
    }
  }
  if (!value.bucket.trim() || !value.accessKeyId.trim() || !value.secretAccessKey.trim()) {
    throw new Error('پیکربندی فضای تصاویر کامل نیست.')
  }
}

export async function readSecureConfiguration(): Promise<SecureConnectionConfiguration | null> {
  const environment = environmentConfiguration()
  if (environment) return environment
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('رمزنگاری امن ویندوز در دسترس نیست.')
    }
    const encrypted = await readFile(configurationFile())
    return JSON.parse(safeStorage.decryptString(encrypted)) as SecureConnectionConfiguration
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveSecureConfiguration(value: SecureConnectionConfiguration) {
  if (environmentConfiguration()) {
    throw new Error('پیکربندی از متغیرهای محیطی خوانده می‌شود و در برنامه قابل تغییر نیست.')
  }
  validateProductionDatabaseUrl(value.databaseUrl)
  validateStorage(value.storage)
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('رمزنگاری امن ویندوز در دسترس نیست؛ اطلاعات ذخیره نشد.')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(value))
  await mkdir(dirname(configurationFile()), { recursive: true })
  await writeFile(configurationFile(), encrypted, { mode: 0o600 })
}

export async function clearSecureConfiguration() {
  if (environmentConfiguration()) {
    throw new Error('برای حذف پیکربندی، متغیرهای محیطی را پاک کنید.')
  }
  try {
    await unlink(configurationFile())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

export async function connectionConfigurationStatus(): Promise<ConnectionConfigurationStatus> {
  const environment = environmentConfiguration()
  if (environment) {
    return {
      configured: true,
      source: 'environment',
      storageConfigured: Boolean(environment.storage) || !app.isPackaged,
    }
  }
  const encrypted = await readSecureConfiguration()
  return {
    configured: Boolean(encrypted?.databaseUrl),
    source: encrypted ? 'encrypted' : 'missing',
    storageConfigured: Boolean(encrypted?.storage) || (Boolean(encrypted?.databaseUrl) && !app.isPackaged),
  }
}
