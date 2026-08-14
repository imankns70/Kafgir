import type { FoodDetailDto } from '@kafgir/contracts'
import { cacheLife, cacheTag } from 'next/cache'
import { sqlClient } from '../db/client'
import { NotFoundError } from '../errors'

export type FoodCatalogDetail = Pick<
  FoodDetailDto,
  | 'foodId'
  | 'slug'
  | 'title'
  | 'isActive'
  | 'shortDescription'
  | 'fullDescription'
  | 'category'
  | 'tags'
  | 'allowsPersianRice'
  | 'primaryBadge'
  | 'images'
  | 'ingredients'
  | 'portionDescription'
  | 'allergyInformation'
  | 'preparationTimeMinutes'
>

type CatalogBase = {
  foodId: number
  slug: string
  title: string
  isActive: boolean
  shortDescription: string | null
  fullDescription: string | null
  ingredients: string | null
  portionDescription: string | null
  allergyInformation: string | null
  preparationTimeMinutes: number | null
  categoryId: number
  categoryTitle: string
  categorySlug: string
  categoryIcon: string | null
  primaryBadgeTagId: number | null
  allowsPersianRice: boolean
}

/**
 * Customer-facing food catalog data changes far less often than live menu state.
 * Keep this cache deliberately short because the desktop admin writes directly to PostgreSQL,
 * so those edits cannot currently invalidate the Next.js cache on demand.
 *
 * The 30-second stale window is also the minimum useful router-cache window for prefetched data.
 */
export async function getFoodCatalogDetail(slug: string): Promise<FoodCatalogDetail> {
  'use cache'

  cacheLife({ stale: 30, revalidate: 60, expire: 3600 })
  cacheTag('food-catalog', `food-catalog:${slug}`)

  const rows = await sqlClient<CatalogBase[]>`
    SELECT f.id AS "foodId", f.slug, f.name AS title, f.is_active AS "isActive",
           f.description AS "shortDescription", f.full_description AS "fullDescription",
           f.ingredients, f.portion_description AS "portionDescription",
           f.allergy_information AS "allergyInformation",
           f.preparation_time_minutes AS "preparationTimeMinutes",
           c.id AS "categoryId", c.title AS "categoryTitle", c.slug AS "categorySlug",
           c.icon AS "categoryIcon", f.primary_badge_tag_id AS "primaryBadgeTagId",
           f.allows_persian_rice AS "allowsPersianRice"
    FROM foods f
    JOIN food_categories c ON c.id = f.category_id
    WHERE f.slug = ${slug}
    LIMIT 1
  `

  const base = rows[0]
  if (!base) throw new NotFoundError('غذا پیدا نشد.')

  const [tags, images] = await Promise.all([
    sqlClient<Array<{
      id: number
      title: string
      slug: string
      icon: string | null
      group: FoodDetailDto['tags'][number]['group']
    }>>`
      SELECT t.id, t.title, t.slug, t.icon, t.group_name AS "group"
      FROM food_to_tags ft
      JOIN food_tags t ON t.id = ft.tag_id
      WHERE ft.food_id = ${base.foodId} AND t.is_active = true AND t.is_customer_visible = true
      ORDER BY t.display_order, t.id
    `,
    sqlClient<FoodDetailDto['images']>`
      SELECT id, image_url AS "imageUrl", alt_text AS "altText",
             display_order AS "displayOrder", is_primary AS "isPrimary"
      FROM food_images
      WHERE food_id = ${base.foodId}
      ORDER BY is_primary DESC, display_order, id
    `,
  ])

  return {
    foodId: base.foodId,
    slug: base.slug,
    title: base.title,
    isActive: base.isActive,
    shortDescription: base.shortDescription,
    fullDescription: base.fullDescription,
    category: {
      id: base.categoryId,
      title: base.categoryTitle,
      slug: base.categorySlug,
      icon: base.categoryIcon,
    },
    tags,
    allowsPersianRice: base.allowsPersianRice,
    primaryBadge: base.primaryBadgeTagId
      ? tags.find((tag) => tag.id === base.primaryBadgeTagId) ?? null
      : null,
    images,
    ingredients: base.ingredients,
    portionDescription: base.portionDescription,
    allergyInformation: base.allergyInformation,
    preparationTimeMinutes: base.preparationTimeMinutes,
  }
}
