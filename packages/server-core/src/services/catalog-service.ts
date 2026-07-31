import type {
  FoodCategoryDto,
  FoodCategoryWriteRequest,
  FoodTagDto,
  FoodTagWriteRequest,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'

type CategoryRecord = Omit<FoodCategoryDto, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string
  updatedAt: Date | string
}

type TagRecord = Omit<FoodTagDto, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string
  updatedAt: Date | string
}

const isoTimestamp = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

const categoryDto = (row: CategoryRecord): FoodCategoryDto => ({
  ...row,
  createdAt: isoTimestamp(row.createdAt),
  updatedAt: isoTimestamp(row.updatedAt),
})

const tagDto = (row: TagRecord): FoodTagDto => ({
  ...row,
  createdAt: isoTimestamp(row.createdAt),
  updatedAt: isoTimestamp(row.updatedAt),
})

export async function listFoodCategories(includeInactive = true): Promise<FoodCategoryDto[]> {
  const rows = await sqlClient<CategoryRecord[]>`
    SELECT id, title, slug, icon, display_order AS "displayOrder",
           is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM food_categories
    WHERE ${includeInactive} OR is_active = true
    ORDER BY display_order, id
  `
  return rows.map(categoryDto)
}

export async function createFoodCategory(request: FoodCategoryWriteRequest): Promise<FoodCategoryDto> {
  try {
    const rows = await sqlClient<CategoryRecord[]>`
      INSERT INTO food_categories
        (title, slug, icon, display_order, is_active, created_at, updated_at)
      VALUES
        (${request.title}, ${request.slug}, ${request.icon ?? null},
         ${request.displayOrder}, ${request.isActive}, NOW(), NOW())
      RETURNING id, title, slug, icon, display_order AS "displayOrder",
                is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return categoryDto(rows[0]!)
  } catch (error) {
    if (String(error).includes('food_categories_slug_uidx')) {
      throw new AppError('این عنوان انگلیسی دسته‌بندی قبلاً استفاده شده است.')
    }
    throw error
  }
}

export async function updateFoodCategory(id: number, request: FoodCategoryWriteRequest): Promise<FoodCategoryDto> {
  try {
    const rows = await sqlClient<CategoryRecord[]>`
      UPDATE food_categories
      SET title = ${request.title}, slug = ${request.slug}, icon = ${request.icon ?? null},
          display_order = ${request.displayOrder}, is_active = ${request.isActive}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, slug, icon, display_order AS "displayOrder",
                is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    `
    if (!rows[0]) throw new NotFoundError('دسته‌بندی پیدا نشد.')
    return categoryDto(rows[0])
  } catch (error) {
    if (String(error).includes('food_categories_slug_uidx')) {
      throw new AppError('این عنوان انگلیسی دسته‌بندی قبلاً استفاده شده است.')
    }
    throw error
  }
}

export async function listFoodTags(includeInactive = true): Promise<FoodTagDto[]> {
  const rows = await sqlClient<TagRecord[]>`
    SELECT id, title, slug, icon, group_name AS "group", display_order AS "displayOrder",
           is_active AS "isActive", is_customer_visible AS "isCustomerVisible",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM food_tags
    WHERE ${includeInactive} OR is_active = true
    ORDER BY group_name, display_order, id
  `
  return rows.map(tagDto)
}

export async function createFoodTag(request: FoodTagWriteRequest): Promise<FoodTagDto> {
  try {
    const rows = await sqlClient<TagRecord[]>`
      INSERT INTO food_tags
        (title, slug, icon, group_name, display_order, is_active,
         is_customer_visible, created_at, updated_at)
      VALUES
        (${request.title}, ${request.slug}, ${request.icon ?? null}, ${request.group},
         ${request.displayOrder}, ${request.isActive}, ${request.isCustomerVisible}, NOW(), NOW())
      RETURNING id, title, slug, icon, group_name AS "group", display_order AS "displayOrder",
                is_active AS "isActive", is_customer_visible AS "isCustomerVisible",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    return tagDto(rows[0]!)
  } catch (error) {
    if (String(error).includes('food_tags_slug_uidx')) {
      throw new AppError('این عنوان انگلیسی برچسب قبلاً استفاده شده است.')
    }
    throw error
  }
}

export async function updateFoodTag(id: number, request: FoodTagWriteRequest): Promise<FoodTagDto> {
  try {
    const rows = await sqlClient<TagRecord[]>`
      UPDATE food_tags
      SET title = ${request.title}, slug = ${request.slug}, icon = ${request.icon ?? null},
          group_name = ${request.group}, display_order = ${request.displayOrder},
          is_active = ${request.isActive}, is_customer_visible = ${request.isCustomerVisible},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, slug, icon, group_name AS "group", display_order AS "displayOrder",
                is_active AS "isActive", is_customer_visible AS "isCustomerVisible",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `
    if (!rows[0]) throw new NotFoundError('برچسب پیدا نشد.')
    return tagDto(rows[0])
  } catch (error) {
    if (String(error).includes('food_tags_slug_uidx')) {
      throw new AppError('این عنوان انگلیسی برچسب قبلاً استفاده شده است.')
    }
    throw error
  }
}
