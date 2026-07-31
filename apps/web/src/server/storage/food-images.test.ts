import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteManagedFoodImage,
  managedFoodImageFileName,
  MAX_FOOD_IMAGE_BYTES,
  readFoodImage,
  storeFoodImage,
} from './food-images'

let testRoot = ''

function blobPart(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

beforeEach(async () => {
  testRoot = await mkdtemp(join(tmpdir(), 'kafgir-food-images-'))
  process.env.FOOD_UPLOAD_ROOT = testRoot
})

afterEach(async () => {
  delete process.env.FOOD_UPLOAD_ROOT
  await rm(testRoot, { recursive: true, force: true })
})

async function imageFile(format: 'jpeg' | 'png' | 'webp', name: string, mime: string) {
  const image = sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: '#e46a4a',
    },
  })
  const bytes = await image[format]().toBuffer()
  return new File([blobPart(bytes)], name, { type: mime })
}

describe('food image storage', () => {
  it.each([
    ['jpeg', 'meal.jpg', 'image/jpeg'],
    ['png', 'meal.png', 'image/png'],
    ['webp', 'meal.webp', 'image/webp'],
  ] as const)('accepts and normalizes %s uploads', async (format, name, mime) => {
    const stored = await storeFoodImage(await imageFile(format, name, mime))
    expect(stored.imageUrl).toMatch(/^\/api\/media\/foods\/[0-9a-f-]+\.webp$/)

    const output = await readFoodImage(stored.fileName)
    const metadata = await sharp(output).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(80)
    expect(metadata.height).toBe(60)
    expect(metadata.exif).toBeUndefined()
  })

  it('limits the longest edge to 1600 pixels without changing aspect ratio', async () => {
    const bytes = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: '#6f7f4e',
      },
    }).jpeg().toBuffer()
    const stored = await storeFoodImage(new File([blobPart(bytes)], 'wide.jpg', { type: 'image/jpeg' }))
    const metadata = await sharp(await readFoodImage(stored.fileName)).metadata()
    expect(metadata.width).toBe(1600)
    expect(metadata.height).toBe(800)
  })

  it('rejects unsupported extensions', async () => {
    await expect(storeFoodImage(await imageFile('jpeg', 'meal.gif', 'image/jpeg')))
      .rejects.toThrow('فرمت فایل')
  })

  it('rejects a MIME type that does not match the file signature', async () => {
    await expect(storeFoodImage(await imageFile('png', 'meal.jpg', 'image/jpeg')))
      .rejects.toThrow('مطابقت ندارد')
  })

  it('rejects oversized and malformed images', async () => {
    const oversized = new Uint8Array(MAX_FOOD_IMAGE_BYTES + 1)
    oversized.set([0xff, 0xd8, 0xff])
    await expect(storeFoodImage(new File([oversized], 'large.jpg', { type: 'image/jpeg' })))
      .rejects.toThrow('5 مگابایت')

    await expect(storeFoodImage(new File([
      new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    ], 'broken.jpg', { type: 'image/jpeg' }))).rejects.toThrow('تصویر سالم')
  })

  it('serves and deletes only managed filenames', async () => {
    const stored = await storeFoodImage(await imageFile('webp', 'meal.webp', 'image/webp'))
    expect(managedFoodImageFileName(stored.imageUrl)).toBe(stored.fileName)
    expect(managedFoodImageFileName('/api/media/foods/../../secret.webp')).toBeNull()
    expect(managedFoodImageFileName('https://images.example/meal.webp')).toBeNull()
    expect(await deleteManagedFoodImage('https://images.example/meal.webp')).toBe(false)
    expect(await deleteManagedFoodImage(stored.imageUrl)).toBe(true)
    await expect(readFoodImage(stored.fileName)).rejects.toThrow('تصویر پیدا نشد')
  })
})
