import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PUT as likeFood } from './[slug]/like/route'
import { PUT as favoriteFood } from './[slug]/favorite/route'
import { POST as createCategory } from '../admin/food-categories/route'
import { InMemoryRateLimitStore, setRateLimitStore } from '@/server/rate-limit'

const context = { params: Promise.resolve({ slug: 'test-food' }) }

beforeEach(() => {
  setRateLimitStore(new InMemoryRateLimitStore({ startSweep: false }))
})

afterEach(() => {
  delete process.env.TELEGRAM_REQUIRE_INIT_DATA
  setRateLimitStore(null)
})

describe('food interaction authorization', () => {
  it.each([
    ['like', likeFood],
    ['favorite', favoriteFood],
  ])('rejects an anonymous %s request', async (_name, handler) => {
    process.env.TELEGRAM_REQUIRE_INIT_DATA = 'true'
    const response = await handler(new NextRequest('http://localhost/api/foods/test-food/action', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), context)
    expect(response.status).toBe(401)
  })

  it.each([
    ['like', likeFood],
    ['favorite', favoriteFood],
  ])('rejects a cross-origin %s mutation before identity or database work', async (_name, handler) => {
    const response = await handler(new NextRequest('http://localhost/api/foods/test-food/action', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
      },
      body: JSON.stringify({}),
    }), context)
    expect(response.status).toBe(401)
  })

  it('protects category management with admin authorization', async () => {
    const response = await createCategory(new NextRequest('http://localhost/api/admin/food-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(response.status).toBe(401)
  })
})
