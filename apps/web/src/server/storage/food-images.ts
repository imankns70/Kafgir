import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import sharp from 'sharp'
import { AppError, NotFoundError } from '../errors'
import { errorFields, logger } from '../logging/logger'
import { configureManagedImageDeleter } from '@kafgir/server-core/storage/image-lifecycle'

export const MAX_FOOD_IMAGE_BYTES = 5 * 1024 * 1024
export const FOOD_IMAGE_MAX_EDGE = 1600
export const MANAGED_FOOD_IMAGE_PREFIX = '/api/media/foods/'

const validFileName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i
const acceptedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp'

export type StoredFoodImage = {
  imageUrl: string
  fileName: string
}

export function foodUploadRoot() {
  const configured = process.env.FOOD_UPLOAD_ROOT?.trim()
  return configured
    ? resolve(configured)
    : resolve(process.cwd(), '../..', '.data', 'uploads')
}

export function foodImageDirectory() {
  return resolve(foodUploadRoot(), 'foods')
}

function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function validateUpload(file: File, bytes: Uint8Array) {
  if (!file.name || !acceptedExtensions.has(extname(file.name).toLowerCase())) {
    throw new AppError('فرمت فایل باید JPG، PNG یا WebP باشد.')
  }
  if (!acceptedMimeTypes.has(file.type)) {
    throw new AppError('نوع فایل تصویر معتبر نیست.')
  }
  if (file.size === 0 || bytes.length === 0) {
    throw new AppError('فایل تصویر خالی است.')
  }
  if (file.size > MAX_FOOD_IMAGE_BYTES || bytes.length > MAX_FOOD_IMAGE_BYTES) {
    throw new AppError('حجم تصویر نباید بیشتر از 5 مگابایت باشد.', 413)
  }
  const detectedType = detectImageType(bytes)
  if (!detectedType || detectedType !== file.type) {
    throw new AppError('محتوای فایل با نوع تصویر انتخاب‌شده مطابقت ندارد.')
  }
}

export async function storeFoodImage(file: File): Promise<StoredFoodImage> {
  const source = new Uint8Array(await file.arrayBuffer())
  validateUpload(file, source)

  let output: Buffer
  try {
    output = await sharp(source, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: FOOD_IMAGE_MAX_EDGE,
        height: FOOD_IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new AppError('فایل انتخاب‌شده یک تصویر سالم نیست.')
  }

  const fileName = `${randomUUID()}.webp`
  const directory = foodImageDirectory()
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, fileName), output, { flag: 'wx' })
  return {
    fileName,
    imageUrl: `${MANAGED_FOOD_IMAGE_PREFIX}${fileName}`,
  }
}

export function managedFoodImageFileName(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith(MANAGED_FOOD_IMAGE_PREFIX)) return null
  const fileName = imageUrl.slice(MANAGED_FOOD_IMAGE_PREFIX.length)
  return validFileName.test(fileName) ? fileName : null
}

export async function deleteManagedFoodImage(imageUrl: string | null | undefined) {
  const fileName = managedFoodImageFileName(imageUrl)
  if (!fileName) return false
  try {
    await unlink(resolve(foodImageDirectory(), fileName))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

configureManagedImageDeleter(deleteManagedFoodImage)

export async function safelyDeleteManagedFoodImage(imageUrl: string | null | undefined) {
  try {
    await deleteManagedFoodImage(imageUrl)
  } catch (error) {
    logger.error({ event: 'food.image.remove.failed', imageUrl, ...errorFields(error) }, 'حذف تصویر مدیریت‌شده ناموفق بود')
  }
}

export async function readFoodImage(fileName: string) {
  if (!validFileName.test(fileName)) throw new NotFoundError('تصویر پیدا نشد.')
  try {
    return await readFile(resolve(foodImageDirectory(), fileName))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('تصویر پیدا نشد.')
    }
    throw error
  }
}
