import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAdminToken } from '@/server/auth/jwt'
import { readFoodImage } from '@/server/storage/food-images'
import { DELETE, POST } from './route'

let testRoot = ''

beforeEach(async () => {
  testRoot = await mkdtemp(join(tmpdir(), 'kafgir-food-route-'))
  process.env.FOOD_UPLOAD_ROOT = testRoot
  process.env.JWT_SIGNING_KEY = 'food-image-route-test-key-32-characters-minimum'
})

afterEach(async () => {
  delete process.env.FOOD_UPLOAD_ROOT
  delete process.env.JWT_SIGNING_KEY
  await rm(testRoot, { recursive: true, force: true })
})

describe('admin food image route', () => {
  it('requires admin authentication before reading the upload', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/foods/images', {
      method: 'POST',
      body: new FormData(),
    }))
    expect(response.status).toBe(401)
  })

  it('uploads and removes an image for an authenticated admin', async () => {
    const { token } = await createAdminToken({
      userId: 1,
      username: 'test-admin',
      fullName: 'Test Admin',
      roles: ['Owner'],
    })
    const source = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: '#f2b233',
      },
    }).png().toBuffer()
    const bytes = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer
    const form = new FormData()
    form.append('image', new File([bytes], 'meal.png', { type: 'image/png' }))

    const uploadResponse = await POST(new NextRequest('http://localhost/api/admin/foods/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }))
    expect(uploadResponse.status).toBe(201)
    const uploaded = await uploadResponse.json() as { imageUrl: string }
    const fileName = uploaded.imageUrl.split('/').at(-1)!
    expect((await readFoodImage(fileName)).byteLength).toBeGreaterThan(0)

    const deleteResponse = await DELETE(new NextRequest('http://localhost/api/admin/foods/images', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uploaded),
    }))
    expect(deleteResponse.status).toBe(204)
    await expect(readFoodImage(fileName)).rejects.toThrow('تصویر پیدا نشد')
  })
})
