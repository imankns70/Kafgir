import type {
  FavoriteFoodDto,
  FoodDetailDto,
  FoodInteractionResponse,
  PersianRiceDto,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { NotFoundError } from '../errors'
import { businessDate } from '../time'
import { getFoodCatalogDetail } from './food-catalog-service'

type OperationalDetail = {
  isActive: boolean
  allowsPersianRice: boolean
  menuItemId: number | null
  menuDate: string | null
  isMenuOpen: boolean | null
  orderDeadline: Date | null
  price: number | null
  originalPrice: number | null
  discountPercentage: number | null
  capacityPortions: number | null
  soldPortions: number | null
  isAvailable: boolean | null
}

export function evaluateFoodAvailability(base: Pick<
  OperationalDetail,
  'isActive' | 'menuItemId' | 'isMenuOpen' | 'isAvailable'
  | 'capacityPortions' | 'soldPortions' | 'orderDeadline'
>) {
  const remaining = Math.max(0, (base.capacityPortions ?? 0) - (base.soldPortions ?? 0))
  if (!base.isActive) return { isOrderable: false, reason: 'این غذا غیرفعال است.', remaining }
  if (!base.menuItemId) return { isOrderable: false, reason: 'این غذا در منوی انتخاب‌شده موجود نیست.', remaining }
  if (!base.isMenuOpen) return { isOrderable: false, reason: 'سفارش‌گیری این منو بسته است.', remaining }
  if (!base.isAvailable) return { isOrderable: false, reason: 'این غذا امروز قابل سفارش نیست.', remaining }
  if (remaining <= 0) return { isOrderable: false, reason: 'ظرفیت این غذا تکمیل شده است.', remaining }
  if (base.orderDeadline && base.orderDeadline.getTime() <= Date.now()) {
    return { isOrderable: false, reason: 'مهلت سفارش این منو به پایان رسیده است.', remaining }
  }
  return {
    isOrderable: true,
    reason: remaining <= 3 ? 'ظرفیت محدود؛ زودتر سفارش دهید.' : 'آماده سفارش',
    remaining,
  }
}

export async function getFoodDetail(
  slug: string,
  menuItemId: number | null,
  userId: number | null,
): Promise<FoodDetailDto> {
  // Stable catalog copy (descriptions, category, tags and images) is cached separately so route
  // prefetching can reuse it. Everything below remains live because price, capacity, menu state and
  // customer interaction can change at any time.
  const catalog = await getFoodCatalogDetail(slug)
  const today = businessDate()

  const [operationalRows, interaction, related] = await Promise.all([
    sqlClient<OperationalDetail[]>`
      SELECT f.is_active AS "isActive", f.allows_persian_rice AS "allowsPersianRice",
             mi.id AS "menuItemId", m.menu_date AS "menuDate", m.is_open AS "isMenuOpen",
             m.order_deadline AS "orderDeadline",
             COALESCE(mi.discount_price, mi.price)::float8 AS price,
             CASE WHEN mi.discount_price IS NOT NULL THEN mi.price::float8 ELSE NULL END AS "originalPrice",
             CASE WHEN mi.discount_price IS NOT NULL
               THEN ROUND(((mi.price - mi.discount_price) / mi.price) * 100)::int
               ELSE NULL END AS "discountPercentage",
             mi.capacity_portions AS "capacityPortions", mi.sold_portions AS "soldPortions",
             mi.is_available AS "isAvailable"
      FROM foods f
      LEFT JOIN LATERAL (
        SELECT i.*
        FROM daily_menu_items i
        JOIN daily_menus selected_menu ON selected_menu.id = i.daily_menu_id
        WHERE i.food_id = f.id
          AND (${menuItemId}::int IS NULL OR i.id = ${menuItemId})
          AND (${menuItemId}::int IS NOT NULL OR selected_menu.menu_date >= ${today}::date)
        ORDER BY selected_menu.menu_date, i.id
        LIMIT 1
      ) mi ON true
      LEFT JOIN daily_menus m ON m.id = mi.daily_menu_id
      WHERE f.id = ${catalog.foodId}
      LIMIT 1
    `,
    sqlClient<Array<{ likeCount: number; isLiked: boolean; isFavorite: boolean }>>`
      SELECT
        (SELECT COUNT(*)::int FROM food_likes WHERE food_id = ${catalog.foodId}) AS "likeCount",
        (${userId}::int IS NOT NULL AND EXISTS(
          SELECT 1 FROM food_likes WHERE food_id = ${catalog.foodId} AND user_id = ${userId}
        )) AS "isLiked",
        (${userId}::int IS NOT NULL AND EXISTS(
          SELECT 1 FROM food_favorites WHERE food_id = ${catalog.foodId} AND user_id = ${userId}
        )) AS "isFavorite"
    `,
    sqlClient<FoodDetailDto['relatedFoods']>`
      SELECT i.id AS "menuItemId", rf.slug, rf.name AS title,
             COALESCE(ri.image_url, rf.image_url) AS "imageUrl",
             COALESCE(i.discount_price, i.price)::float8 AS price,
             CASE WHEN i.discount_price IS NOT NULL THEN i.price::float8 ELSE NULL END AS "originalPrice",
             CASE WHEN i.discount_price IS NOT NULL
               THEN ROUND(((i.price - i.discount_price) / i.price) * 100)::int
               ELSE NULL END AS "discountPercentage",
             CASE WHEN bt.id IS NULL THEN NULL
               ELSE json_build_object('title', bt.title, 'icon', bt.icon) END AS "primaryBadge",
             rf.allows_persian_rice AS "allowsPersianRice"
      FROM daily_menu_items i
      JOIN daily_menus m ON m.id = i.daily_menu_id
      JOIN foods rf ON rf.id = i.food_id
      LEFT JOIN food_tags bt ON bt.id = rf.primary_badge_tag_id
        AND bt.is_active = true AND bt.is_customer_visible = true
      LEFT JOIN LATERAL (
        SELECT image_url FROM food_images
        WHERE food_id = rf.id ORDER BY is_primary DESC, display_order, id LIMIT 1
      ) ri ON true
      WHERE rf.id <> ${catalog.foodId} AND rf.is_active = true AND NOT rf.is_persian_rice
        AND m.menu_date >= ${today}::date AND m.is_open = true
        AND i.is_available = true AND i.capacity_portions > i.sold_portions
      ORDER BY
        CASE WHEN rf.category_id = ${catalog.category.id} THEN 0 ELSE 1 END,
        (SELECT COUNT(*) FROM food_to_tags own_tags
         JOIN food_to_tags related_tags ON related_tags.tag_id = own_tags.tag_id
         WHERE own_tags.food_id = ${catalog.foodId} AND related_tags.food_id = rf.id) DESC,
        m.menu_date, i.id
      LIMIT 4
    `,
  ])

  const operational = operationalRows[0]
  if (!operational) throw new NotFoundError('غذا پیدا نشد.')

  // The Persian upgrade belongs to the selected menu, not to the catalog entry, so it stays live.
  const persianRice = operational.menuItemId
    ? await sqlClient<PersianRiceDto[]>`
        SELECT ri.id AS "menuItemId", rf.id AS "foodId",
               rf.name AS title, rf.image_url AS "imageUrl",
               COALESCE(ri.discount_price, ri.price)::float8 AS price,
               ri.capacity_portions AS "capacityPortions", ri.sold_portions AS "soldPortions",
               ri.capacity_portions - ri.sold_portions AS "remainingPortions",
               (ri.is_available AND rf.is_active) AS "isAvailable"
        FROM daily_menu_items ri
        JOIN foods rf ON rf.id = ri.food_id
        WHERE rf.is_persian_rice
          AND ri.daily_menu_id = (SELECT daily_menu_id FROM daily_menu_items WHERE id = ${operational.menuItemId})
        ORDER BY ri.id
        LIMIT 1
      `
    : []

  const state = evaluateFoodAvailability(operational)
  return {
    menuItemId: operational.menuItemId,
    foodId: catalog.foodId,
    slug: catalog.slug,
    title: catalog.title,
    isActive: operational.isActive,
    shortDescription: catalog.shortDescription,
    fullDescription: catalog.fullDescription,
    category: catalog.category,
    tags: catalog.tags,
    allowsPersianRice: operational.allowsPersianRice,
    persianRice: persianRice[0] ?? null,
    primaryBadge: catalog.primaryBadge,
    images: catalog.images,
    ingredients: catalog.ingredients,
    portionDescription: catalog.portionDescription,
    allergyInformation: catalog.allergyInformation,
    preparationTimeMinutes: catalog.preparationTimeMinutes,
    price: operational.price,
    originalPrice: operational.originalPrice,
    discountPercentage: operational.discountPercentage,
    menuDate: operational.menuDate,
    remainingCapacity: state.remaining,
    orderDeadline: operational.orderDeadline?.toISOString() ?? null,
    isOrderable: state.isOrderable,
    availabilityReason: state.reason,
    likeCount: interaction[0]?.likeCount ?? 0,
    isLikedByCurrentUser: interaction[0]?.isLiked ?? false,
    isFavoriteByCurrentUser: interaction[0]?.isFavorite ?? false,
    relatedFoods: related,
  }
}

export async function setFoodLike(foodId: number, userId: number, liked: boolean) {
  if (liked) {
    await sqlClient`
      INSERT INTO food_likes (food_id, user_id, created_at)
      VALUES (${foodId}, ${userId}, NOW())
      ON CONFLICT DO NOTHING
    `
  } else {
    await sqlClient`DELETE FROM food_likes WHERE food_id = ${foodId} AND user_id = ${userId}`
  }
  return interactionState(foodId, userId)
}

export async function getFoodIdBySlug(slug: string) {
  const rows = await sqlClient<{ id: number }[]>`
    SELECT id FROM foods WHERE slug = ${slug} LIMIT 1
  `
  if (!rows[0]) throw new NotFoundError('غذا پیدا نشد.')
  return rows[0].id
}

export async function setFoodFavorite(foodId: number, userId: number, favorite: boolean) {
  if (favorite) {
    await sqlClient`
      INSERT INTO food_favorites (food_id, user_id, created_at)
      VALUES (${foodId}, ${userId}, NOW())
      ON CONFLICT DO NOTHING
    `
  } else {
    await sqlClient`DELETE FROM food_favorites WHERE food_id = ${foodId} AND user_id = ${userId}`
  }
  return interactionState(foodId, userId)
}

async function interactionState(foodId: number, userId: number): Promise<FoodInteractionResponse> {
  const rows = await sqlClient<Array<{
    likeCount: number
    isLikedByCurrentUser: boolean
    isFavoriteByCurrentUser: boolean
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM food_likes WHERE food_id = ${foodId}) AS "likeCount",
      EXISTS(SELECT 1 FROM food_likes WHERE food_id = ${foodId} AND user_id = ${userId})
        AS "isLikedByCurrentUser",
      EXISTS(SELECT 1 FROM food_favorites WHERE food_id = ${foodId} AND user_id = ${userId})
        AS "isFavoriteByCurrentUser"
  `
  return rows[0]!
}

export async function listFavoriteFoods(userId: number): Promise<FavoriteFoodDto[]> {
  return sqlClient<FavoriteFoodDto[]>`
    SELECT f.id AS "foodId", f.slug, f.name AS title,
           f.description AS "shortDescription",
           COALESCE(fi.image_url, f.image_url) AS "imageUrl",
           c.title AS "categoryTitle"
    FROM food_favorites favorite
    JOIN foods f ON f.id = favorite.food_id AND f.is_active = true
    JOIN food_categories c ON c.id = f.category_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM food_images
      WHERE food_id = f.id ORDER BY is_primary DESC, display_order, id LIMIT 1
    ) fi ON true
    WHERE favorite.user_id = ${userId}
    ORDER BY favorite.created_at DESC
  `
}
