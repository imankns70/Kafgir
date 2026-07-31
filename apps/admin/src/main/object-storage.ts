import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import type { SecureConnectionConfiguration } from '../shared/admin-operations'

const maximumBytes = 5 * 1024 * 1024
const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const validMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

type StorageConfiguration = NonNullable<SecureConnectionConfiguration['storage']>

let configuration: StorageConfiguration | null = null
let client: S3Client | null = null
let localUploadRoot: string | null = null

export function hasConfiguredFoodImageStorage() {
  return Boolean((configuration && client) || localUploadRoot)
}

export function configureObjectStorage(
  value: StorageConfiguration | null | undefined,
  developmentUploadRoot?: string | null,
) {
  configuration = value ?? null
  localUploadRoot = configuration ? null : developmentUploadRoot ? resolve(developmentUploadRoot) : null
  client = configuration
    ? new S3Client({
      region: 'default',
      endpoint: configuration.endpoint,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
      forcePathStyle: true,
    })
    : null
}

function requiredStorage() {
  if (configuration && client) return { kind: 'object' as const, configuration, client }
  if (localUploadRoot) return { kind: 'local' as const, root: localUploadRoot }
  {
    throw new Error('فضای ذخیره‌سازی تصاویر پیکربندی نشده است.')
  }
}

function sourceBytes(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  if (!bytes.length || bytes.length > maximumBytes) {
    throw new Error('حجم تصویر باید بین صفر و 5 مگابایت باشد.')
  }
  return bytes
}

function detectedMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) return 'image/webp'
  return null
}

export async function uploadFoodImage(request: {
  name: string
  type: string
  bytes: ArrayBuffer
}) {
  if (!validExtensions.has(extname(request.name).toLowerCase()) || !validMimeTypes.has(request.type)) {
    throw new Error('فرمت تصویر باید JPG، PNG یا WebP باشد.')
  }
  const source = sourceBytes(request.bytes)
  if (detectedMime(source) !== request.type) {
    throw new Error('محتوای فایل با نوع تصویر مطابقت ندارد.')
  }
  let output: Buffer
  try {
    output = await sharp(source, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new Error('فایل انتخاب‌شده تصویر سالمی نیست.')
  }
  const storage = requiredStorage()
  const fileName = `${randomUUID()}.webp`
  const key = `foods/${fileName}`
  if (storage.kind === 'object') {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.configuration.bucket,
      Key: key,
      Body: output,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  } else {
    const directory = resolve(storage.root, 'foods')
    await mkdir(directory, { recursive: true })
    await writeFile(resolve(directory, fileName), output, { flag: 'wx' })
  }
  return {
    imageUrl: storage.kind === 'object'
      ? `${storage.configuration.publicBaseUrl.replace(/\/$/u, '')}/${key}`
      : `/api/media/foods/${fileName}`,
  }
}

export async function deleteManagedFoodImage(imageUrl: string) {
  const storage = requiredStorage()
  const localMatch = imageUrl.match(/^\/api\/media\/foods\/([0-9a-f-]{36}\.webp)$/iu)
  if (localMatch) {
    if (storage.kind !== 'local') return false
    try {
      await unlink(resolve(storage.root, 'foods', localMatch[1]!))
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }
  if (storage.kind !== 'object') return false
  const base = `${storage.configuration.publicBaseUrl.replace(/\/$/u, '')}/`
  if (!imageUrl.startsWith(`${base}foods/`)) return false
  const key = decodeURIComponent(imageUrl.slice(base.length))
  if (!/^foods\/[0-9a-f-]{36}\.webp$/iu.test(key)) return false
  await storage.client.send(new DeleteObjectCommand({
    Bucket: storage.configuration.bucket,
    Key: key,
  }))
  return true
}
