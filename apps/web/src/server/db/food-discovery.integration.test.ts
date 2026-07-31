import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getFoodDetail,
  listFavoriteFoods,
  setFoodFavorite,
  setFoodLike,
} from '../services/food-discovery-service'
import { listFoodTags } from '../services/catalog-service'
import { createFood, updateFood } from '../services/food-service'

const connectionString = process.env.TEST_DATABASE_URL
const canRun = Boolean(connectionString && process.env.DATABASE_URL === connectionString)
const integration = describe.skipIf(!canRun)
let sql: ReturnType<typeof postgres>
const suffix = crypto.randomUUID()
let categoryId = 0
let visibleTagId = 0
let internalTagId = 0
let foodId = 0
let relatedFoodId = 0
let menuId = 0
let userId = 0
const slug = `detail-${suffix}`

integration('food discovery PostgreSQL behavior', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) throw new Error('Food discovery tests require a test database.')
    sql = postgres(connectionString!, { max: 2 })
    const categories = await sql<{ id: number }[]>`
      INSERT INTO food_categories
        (title, slug, display_order, is_active, created_at, updated_at)
      VALUES ('Test category', ${`category-${suffix}`}, 900, true, NOW(), NOW())
      RETURNING id
    `
    categoryId = categories[0]!.id
    const tags = await sql<{ id: number; visible: boolean }[]>`
      INSERT INTO food_tags
        (title, slug, group_name, display_order, is_active, is_customer_visible, created_at, updated_at)
      VALUES
        ('Visible', ${`visible-${suffix}`}, 'status', 1, true, true, NOW(), NOW()),
        ('Internal', ${`internal-${suffix}`}, 'status', 2, true, false, NOW(), NOW())
      RETURNING id, is_customer_visible AS visible
    `
    visibleTagId = tags.find((tag) => tag.visible)!.id
    internalTagId = tags.find((tag) => !tag.visible)!.id
    const foods = await sql<{ id: number; slug: string }[]>`
      INSERT INTO foods
        (name, slug, description, category_id, primary_badge_tag_id,
         default_price, is_active, created_at, updated_at)
      VALUES
        ('Detail food', ${slug}, 'Short', ${categoryId}, ${visibleTagId}, 100, true, NOW(), NOW()),
        ('Related food', ${`related-${suffix}`}, 'Related', ${categoryId}, NULL, 120, true, NOW(), NOW())
      RETURNING id, slug
    `
    foodId = foods.find((food) => food.slug === slug)!.id
    relatedFoodId = foods.find((food) => food.slug !== slug)!.id
    await sql`
      INSERT INTO food_to_tags (food_id, tag_id, created_at)
      VALUES
        (${foodId}, ${visibleTagId}, NOW()),
        (${foodId}, ${internalTagId}, NOW()),
        (${relatedFoodId}, ${visibleTagId}, NOW())
    `
    const menus = await sql<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date, is_open, created_at)
      VALUES ('2099-02-01', true, NOW())
      RETURNING id
    `
    menuId = menus[0]!.id
    await sql`
      INSERT INTO daily_menu_items
        (daily_menu_id, food_id, price, capacity_portions, sold_portions, is_available, created_at)
      VALUES
        (${menuId}, ${foodId}, 150, 5, 1, true, NOW()),
        (${menuId}, ${relatedFoodId}, 120, 3, 0, true, NOW())
    `
    const users = await sql<{ id: number }[]>`
      INSERT INTO users
        (username, normalized_username, full_name, is_active, created_at)
      VALUES (${`user-${suffix}`}, ${`USER-${suffix}`.toUpperCase()}, 'Test user', true, NOW())
      RETURNING id
    `
    userId = users[0]!.id
  })

  afterAll(async () => {
    await sql`DELETE FROM users WHERE id = ${userId}`
    await sql`DELETE FROM daily_menus WHERE id = ${menuId}`
    await sql`DELETE FROM foods WHERE id IN (${foodId}, ${relatedFoodId})`
    await sql`DELETE FROM food_tags WHERE id IN (${visibleTagId}, ${internalTagId})`
    await sql`DELETE FROM food_categories WHERE id = ${categoryId}`
    await sql.end()
  })

  it('assigns one category, multiple tags, and prevents duplicate relations', async () => {
    const rows = await sql<{ categoryId: number; tagCount: number }[]>`
      SELECT f.category_id AS "categoryId", COUNT(ft.tag_id)::int AS "tagCount"
      FROM foods f JOIN food_to_tags ft ON ft.food_id = f.id
      WHERE f.id = ${foodId}
      GROUP BY f.category_id
    `
    expect(rows[0]).toEqual({ categoryId, tagCount: 2 })
    await expect(sql`
      INSERT INTO food_to_tags (food_id, tag_id, created_at)
      VALUES (${foodId}, ${visibleTagId}, NOW())
    `).rejects.toMatchObject({ code: '23505' })
  })

  it('serializes PostgreSQL catalog timestamps as ISO strings', async () => {
    const tags = await listFoodTags()
    const tag = tags.find((item) => item.id === visibleTagId)
    expect(tag?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(tag?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('rejects duplicate food display names', async () => {
    const request = {
      name: 'Detail food',
      slug: `duplicate-name-${suffix}`,
      description: null,
      fullDescription: null,
      ingredients: null,
      portionDescription: null,
      allergyInformation: null,
      preparationTimeMinutes: null,
      categoryId,
      tagIds: [],
      primaryBadgeTagId: null,
      images: [],
      defaultPrice: 100,
      imageUrl: null,
      isActive: true,
    }
    await expect(createFood(request)).rejects.toThrow('نام غذا تکراری است.')
    await expect(updateFood(relatedFoodId, {
      ...request,
      slug: `duplicate-update-${suffix}`,
    })).rejects.toThrow('نام غذا تکراری است.')
  })

  it('supports category deactivation without deleting referenced foods', async () => {
    await sql`UPDATE food_categories SET is_active = false WHERE id = ${categoryId}`
    const rows = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM foods WHERE category_id = ${categoryId}`
    expect(rows[0]?.count).toBe(2)
    await sql`UPDATE food_categories SET is_active = true WHERE id = ${categoryId}`
  })

  it('keeps like and favorite operations idempotent', async () => {
    await setFoodLike(foodId, userId, true)
    await setFoodLike(foodId, userId, true)
    await setFoodFavorite(foodId, userId, true)
    await setFoodFavorite(foodId, userId, true)
    const detail = await getFoodDetail(slug, null, userId)
    expect(detail.likeCount).toBe(1)
    expect(detail.isLikedByCurrentUser).toBe(true)
    expect(detail.isFavoriteByCurrentUser).toBe(true)
    expect((await listFavoriteFoods(userId)).some((food) => food.foodId === foodId)).toBe(true)

    await setFoodLike(foodId, userId, false)
    await setFoodLike(foodId, userId, false)
    await setFoodFavorite(foodId, userId, false)
    await setFoodFavorite(foodId, userId, false)
    const updated = await getFoodDetail(slug, null, userId)
    expect(updated.isLikedByCurrentUser).toBe(false)
    expect(updated.isFavoriteByCurrentUser).toBe(false)
  })

  it('returns visible tags only and excludes the current food from related results', async () => {
    const detail = await getFoodDetail(slug, null, userId)
    expect(detail.category.id).toBe(categoryId)
    expect(detail.tags.map((tag) => tag.id)).toEqual([visibleTagId])
    expect(detail.tags.some((tag) => tag.id === internalTagId)).toBe(false)
    expect(detail.relatedFoods.some((food) => food.slug === slug)).toBe(false)
    expect(detail.relatedFoods.some((food) => food.slug === `related-${suffix}`)).toBe(true)
    expect(detail.remainingCapacity).toBe(4)
  })
})
