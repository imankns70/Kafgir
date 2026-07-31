import type { FoodDto, FoodImageDto, FoodWriteRequest } from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { safelyDeleteManagedFoodImage } from '../storage/image-lifecycle'

type FoodRecord = {
  id: number
  name: string
  slug: string
  description: string | null
  fullDescription: string | null
  ingredients: string | null
  portionDescription: string | null
  allergyInformation: string | null
  preparationTimeMinutes: number | null
  categoryId: number
  primaryBadgeTagId: number | null
  defaultPrice: number
  imageUrl: string | null
  isActive: boolean
}

type FoodImageRecord = FoodImageDto & { foodId: number }
type FoodTagRecord = { foodId: number; tagId: number }

async function hydrateFoods(rows: FoodRecord[]): Promise<FoodDto[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const [tagRows, imageRows] = await Promise.all([
    sqlClient<FoodTagRecord[]>`
      SELECT food_id AS "foodId", tag_id AS "tagId"
      FROM food_to_tags WHERE food_id IN ${sqlClient(ids)}
      ORDER BY tag_id
    `,
    sqlClient<FoodImageRecord[]>`
      SELECT id, food_id AS "foodId", image_url AS "imageUrl", alt_text AS "altText",
             display_order AS "displayOrder", is_primary AS "isPrimary"
      FROM food_images WHERE food_id IN ${sqlClient(ids)}
      ORDER BY food_id, display_order, id
    `,
  ])
  return rows.map((row) => ({
    ...row,
    tagIds: tagRows.filter((tag) => tag.foodId === row.id).map((tag) => tag.tagId),
    images: imageRows.filter((image) => image.foodId === row.id).map(({ foodId: _, ...image }) => image),
  }))
}

export async function listFoods(): Promise<FoodDto[]> {
  const rows = await sqlClient<FoodRecord[]>`
    SELECT id, name, slug, description, full_description AS "fullDescription",
           ingredients, portion_description AS "portionDescription",
           allergy_information AS "allergyInformation",
           preparation_time_minutes AS "preparationTimeMinutes",
           category_id AS "categoryId", primary_badge_tag_id AS "primaryBadgeTagId",
           default_price::float8 AS "defaultPrice", image_url AS "imageUrl",
           is_active AS "isActive"
    FROM foods
    ORDER BY name
  `
  return hydrateFoods(rows)
}

export async function getFood(id: number): Promise<FoodDto> {
  const rows = await sqlClient<FoodRecord[]>`
    SELECT id, name, slug, description, full_description AS "fullDescription",
           ingredients, portion_description AS "portionDescription",
           allergy_information AS "allergyInformation",
           preparation_time_minutes AS "preparationTimeMinutes",
           category_id AS "categoryId", primary_badge_tag_id AS "primaryBadgeTagId",
           default_price::float8 AS "defaultPrice", image_url AS "imageUrl",
           is_active AS "isActive"
    FROM foods WHERE id = ${id} LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError()
  return (await hydrateFoods(rows))[0]!
}

async function validateRelations(tx: TransactionSql, request: FoodWriteRequest) {
  const categories = await tx<{ id: number }[]>`
    SELECT id FROM food_categories WHERE id = ${request.categoryId} LIMIT 1
  `
  if (!categories[0]) throw new AppError('دسته‌بندی انتخاب‌شده پیدا نشد.')
  if (request.tagIds.length > 0) {
    const tags = await tx<{ id: number }[]>`
      SELECT id FROM food_tags WHERE id IN ${tx(request.tagIds)}
    `
    if (tags.length !== request.tagIds.length) throw new AppError('یک یا چند برچسب انتخاب‌شده معتبر نیست.')
  }
  if (request.primaryBadgeTagId && !request.tagIds.includes(request.primaryBadgeTagId)) {
    throw new AppError('نشان اصلی باید یکی از برچسب‌های انتخاب‌شده باشد.')
  }
}

async function ensureUniqueFoodName(tx: TransactionSql, name: string, excludedId?: number) {
  const rows = excludedId
    ? await tx<{ id: number }[]>`
      SELECT id FROM foods
      WHERE lower(btrim(name)) = lower(btrim(${name})) AND id <> ${excludedId}
      LIMIT 1
    `
    : await tx<{ id: number }[]>`
      SELECT id FROM foods
      WHERE lower(btrim(name)) = lower(btrim(${name}))
      LIMIT 1
    `
  if (rows[0]) throw new AppError('نام غذا تکراری است.')
}

function primaryImageUrl(request: FoodWriteRequest) {
  return request.images.find((image) => image.isPrimary)?.imageUrl
    ?? request.images[0]?.imageUrl
    ?? request.imageUrl
    ?? null
}

function translateFoodUniqueError(error: unknown) {
  const message = String(error)
  if (message.includes('foods_name_normalized_uidx')) throw new AppError('نام غذا تکراری است.')
  if (message.includes('foods_slug_uidx')) throw new AppError('این عنوان انگلیسی غذا قبلاً استفاده شده است.')
}

async function writeRelations(tx: TransactionSql, foodId: number, request: FoodWriteRequest) {
  for (const tagId of request.tagIds) {
    await tx`
      INSERT INTO food_to_tags (food_id, tag_id, created_at)
      VALUES (${foodId}, ${tagId}, NOW())
      ON CONFLICT DO NOTHING
    `
  }
  for (const [index, image] of request.images.entries()) {
    await tx`
      INSERT INTO food_images
        (food_id, image_url, alt_text, display_order, is_primary, created_at)
      VALUES
        (${foodId}, ${image.imageUrl}, ${image.altText},
         ${image.displayOrder ?? index}, ${image.isPrimary}, NOW())
    `
  }
}

export async function createFood(request: FoodWriteRequest): Promise<FoodDto> {
  let id: number
  try {
    id = await sqlClient.begin(async (tx) => {
      await validateRelations(tx, request)
      await ensureUniqueFoodName(tx, request.name)
      const rows = await tx<{ id: number }[]>`
        INSERT INTO foods
          (name, slug, description, full_description, ingredients, portion_description,
           allergy_information, preparation_time_minutes, category_id, primary_badge_tag_id,
           default_price, image_url, is_active, created_at, updated_at)
        VALUES
          (${request.name}, ${request.slug}, ${request.description ?? null},
           ${request.fullDescription ?? null}, ${request.ingredients ?? null},
           ${request.portionDescription ?? null}, ${request.allergyInformation ?? null},
           ${request.preparationTimeMinutes ?? null}, ${request.categoryId},
           ${request.primaryBadgeTagId ?? null}, ${request.defaultPrice},
           ${primaryImageUrl(request)}, ${request.isActive}, NOW(), NOW())
        RETURNING id
      `
      await writeRelations(tx, rows[0]!.id, request)
      return rows[0]!.id
    })
  } catch (error) {
    translateFoodUniqueError(error)
    throw error
  }
  return getFood(id)
}

export async function updateFood(id: number, request: FoodWriteRequest): Promise<void> {
  let removedImageUrls: string[] = []
  try {
    removedImageUrls = await sqlClient.begin(async (tx) => {
      await validateRelations(tx, request)
      await ensureUniqueFoodName(tx, request.name, id)
      const previous = await tx<{ imageUrl: string }[]>`
        SELECT image_url AS "imageUrl" FROM food_images WHERE food_id = ${id}
        UNION
        SELECT image_url AS "imageUrl" FROM foods WHERE id = ${id} AND image_url IS NOT NULL
      `
      const updated = await tx<{ id: number }[]>`
        UPDATE foods
        SET name = ${request.name}, slug = ${request.slug},
            description = ${request.description ?? null},
            full_description = ${request.fullDescription ?? null},
            ingredients = ${request.ingredients ?? null},
            portion_description = ${request.portionDescription ?? null},
            allergy_information = ${request.allergyInformation ?? null},
            preparation_time_minutes = ${request.preparationTimeMinutes ?? null},
            category_id = ${request.categoryId},
            primary_badge_tag_id = ${request.primaryBadgeTagId ?? null},
            default_price = ${request.defaultPrice}, image_url = ${primaryImageUrl(request)},
            is_active = ${request.isActive}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id
      `
      if (!updated[0]) throw new NotFoundError()
      await tx`DELETE FROM food_to_tags WHERE food_id = ${id}`
      await tx`DELETE FROM food_images WHERE food_id = ${id}`
      await writeRelations(tx, id, request)
      const retained = new Set(request.images.map((image) => image.imageUrl))
      if (request.imageUrl) retained.add(request.imageUrl)
      return previous.map((image) => image.imageUrl).filter((imageUrl) => !retained.has(imageUrl))
    })
  } catch (error) {
    translateFoodUniqueError(error)
    throw error
  }
  await Promise.all(removedImageUrls.map(safelyDeleteManagedFoodImage))
}

export async function setFoodActive(id: number, isActive: boolean): Promise<void> {
  const result = await sqlClient`UPDATE foods SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}`
  if (result.count === 0) throw new NotFoundError()
}
