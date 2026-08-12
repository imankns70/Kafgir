import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { v2 as cloudinary } from 'cloudinary'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  configureFoodImageStorage,
  deleteManagedFoodImage,
  hasConfiguredFoodImageStorage,
  uploadFoodImage,
} from './object-storage'

let testRoot: string | null = null

afterEach(async () => {
  configureFoodImageStorage(null, null)
  vi.restoreAllMocks()
  if (testRoot) await rm(testRoot, { recursive: true, force: true })
  testRoot = null
})

describe('Cloudinary food image storage', () => {
  it('uploads under the managed folder and deletes only its own returned URL', async () => {
    const secureUrl = 'https://res.cloudinary.com/kafgir/image/upload/v1/kafgir/foods/00000000-0000-4000-8000-000000000001.webp'
    const upload = vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((...args: unknown[]) => {
      const options = args[0] as Record<string, unknown>
      const callback = args[1] as ((error?: unknown, result?: unknown) => void) | undefined
      const stream = new PassThrough()
      stream.on('finish', () => callback?.(undefined, { secure_url: secureUrl } as never))
      expect(options).toMatchObject({
        public_id: expect.stringMatching(/^kafgir\/foods\/[0-9a-f-]{36}$/u),
        format: 'webp',
        overwrite: false,
      })
      return stream as never
    })
    const destroy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' })
    configureFoodImageStorage({ cloudName: 'kafgir', apiKey: 'key', apiSecret: 'secret' })
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#e46a4a' },
    }).png().toBuffer()

    const uploaded = await uploadFoodImage({
      name: 'food.png',
      type: 'image/png',
      bytes: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer,
    })

    expect(uploaded.imageUrl).toBe(secureUrl)
    expect(upload).toHaveBeenCalledOnce()
    await expect(deleteManagedFoodImage(secureUrl)).resolves.toBe(true)
    expect(destroy).toHaveBeenCalledWith('kafgir/foods/00000000-0000-4000-8000-000000000001', {
      resource_type: 'image',
      invalidate: true,
    })
    await expect(deleteManagedFoodImage('https://example.com/not-managed.webp')).resolves.toBe(false)
  })
})

describe('development food image storage', () => {
  async function samplePng() {
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#e46a4a' },
    }).png().toBuffer()
    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
  }

  it('writes normalized WebP files locally and removes them', async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'kafgir-admin-images-'))
    configureFoodImageStorage(null, testRoot)
    const bytes = await samplePng()

    const result = await uploadFoodImage({ name: 'food.png', type: 'image/png', bytes })

    expect(result.imageUrl).toMatch(/^\/api\/media\/foods\/[0-9a-f-]{36}\.webp$/u)
    const fileName = result.imageUrl.split('/').at(-1)!
    const saved = await readFile(join(testRoot, 'foods', fileName))
    expect(saved.subarray(0, 4).toString('ascii')).toBe('RIFF')
    await expect(deleteManagedFoodImage(result.imageUrl)).resolves.toBe(true)
    await expect(deleteManagedFoodImage(result.imageUrl)).resolves.toBe(false)
  })

  it('keeps local storage available across repeated uploads', async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'kafgir-admin-images-'))
    configureFoodImageStorage(null, testRoot)
    const bytes = await samplePng()

    const first = await uploadFoodImage({ name: 'first.png', type: 'image/png', bytes })
    const second = await uploadFoodImage({ name: 'second.png', type: 'image/png', bytes })

    expect(hasConfiguredFoodImageStorage()).toBe(true)
    expect(first.imageUrl).not.toBe(second.imageUrl)
    await expect(deleteManagedFoodImage(first.imageUrl)).resolves.toBe(true)
    await expect(deleteManagedFoodImage(second.imageUrl)).resolves.toBe(true)
  })
})
