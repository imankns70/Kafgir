import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  configureObjectStorage,
  deleteManagedFoodImage,
  hasConfiguredFoodImageStorage,
  uploadFoodImage,
} from './object-storage'

let testRoot: string | null = null

afterEach(async () => {
  configureObjectStorage(null, null)
  if (testRoot) await rm(testRoot, { recursive: true, force: true })
  testRoot = null
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
    configureObjectStorage(null, testRoot)
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
    configureObjectStorage(null, testRoot)
    const bytes = await samplePng()

    const first = await uploadFoodImage({ name: 'first.png', type: 'image/png', bytes })
    const second = await uploadFoodImage({ name: 'second.png', type: 'image/png', bytes })

    expect(hasConfiguredFoodImageStorage()).toBe(true)
    expect(first.imageUrl).not.toBe(second.imageUrl)
    await expect(deleteManagedFoodImage(first.imageUrl)).resolves.toBe(true)
    await expect(deleteManagedFoodImage(second.imageUrl)).resolves.toBe(true)
  })
})
