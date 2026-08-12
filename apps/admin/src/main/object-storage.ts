import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import sharp from 'sharp'
import type { SecureConnectionConfiguration } from '../shared/admin-operations'

const maximumBytes = 5 * 1024 * 1024
const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const validMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

type CloudinaryConfiguration = NonNullable<SecureConnectionConfiguration['cloudinary']>

let configuration: CloudinaryConfiguration | null = null
let localUploadRoot: string | null = null

export function hasConfiguredFoodImageStorage() {
  return Boolean(configuration || localUploadRoot)
}

export function configureFoodImageStorage(
  value: CloudinaryConfiguration | null | undefined,
  developmentUploadRoot?: string | null,
) {
  configuration = value ?? null
  localUploadRoot = configuration ? null : developmentUploadRoot ? resolve(developmentUploadRoot) : null
  if (configuration) {
    cloudinary.config({
      cloud_name: configuration.cloudName,
      api_key: configuration.apiKey,
      api_secret: configuration.apiSecret,
      secure: true,
    })
  }
}

function requiredStorage() {
  if (configuration) return { kind: 'cloudinary' as const, configuration }
  if (localUploadRoot) return { kind: 'local' as const, root: localUploadRoot }
  {
    throw new Error('فضای ذخیره‌سازی تصاویر پیکربندی نشده است.')
  }
}

function uploadToCloudinary(output: Buffer, publicId: string) {
  return new Promise<UploadApiResponse>((resolveUpload, rejectUpload) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      resource_type: 'image',
      format: 'webp',
      overwrite: false,
      tags: ['kafgir-food'],
    }, (error, result) => {
      if (error) rejectUpload(new Error(`آپلود تصویر در Cloudinary ناموفق بود: ${error.message}`))
      else if (!result?.secure_url) rejectUpload(new Error('Cloudinary آدرس امن تصویر را برنگرداند.'))
      else resolveUpload(result)
    })
    stream.end(output)
  })
}

function cloudinaryPublicId(imageUrl: string, cloudName: string) {
  let url: URL
  try {
    url = new URL(imageUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null
  const prefix = `/${cloudName}/image/upload/`
  if (!url.pathname.startsWith(prefix)) return null
  const path = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^v\d+\//u, '')
  const publicId = path.replace(/\.webp$/iu, '')
  return /^kafgir\/foods\/[0-9a-f-]{36}$/iu.test(publicId) ? publicId : null
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
  const publicId = `kafgir/foods/${fileName.replace(/\.webp$/u, '')}`
  let imageUrl: string
  if (storage.kind === 'cloudinary') {
    const uploaded = await uploadToCloudinary(output, publicId)
    imageUrl = uploaded.secure_url
  } else {
    const directory = resolve(storage.root, 'foods')
    await mkdir(directory, { recursive: true })
    await writeFile(resolve(directory, fileName), output, { flag: 'wx' })
    imageUrl = `/api/media/foods/${fileName}`
  }
  return { imageUrl }
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
  if (storage.kind !== 'cloudinary') return false
  const publicId = cloudinaryPublicId(imageUrl, storage.configuration.cloudName)
  if (!publicId) return false
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  }) as { result?: string }
  return result.result === 'ok'
}
