import type {
  DailyMenuDto,
  DailyMenuItemWriteRequest,
  DailyMenuWriteRequest,
  UpdateDailyMenuItemRequest,
  UpdateDailyMenuSettingsRequest,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'

type MenuRecord = {
  id: number
  menuDate: string
  isOpen: boolean
  note: string | null
  orderDeadline: Date | null
}
type ItemRecord = {
  id: number
  foodId: number
  slug: string
  foodName: string
  foodDescription: string | null
  imageUrl: string | null
  categoryId: number
  categoryTitle: string
  categorySlug: string
  categoryIcon: string | null
  badgeId: number | null
  badgeTitle: string | null
  badgeSlug: string | null
  badgeIcon: string | null
  price: number
  capacityPortions: number
  soldPortions: number
  isAvailable: boolean
}

export async function getMenuByDate(menuDate: string, customerVisible = false): Promise<DailyMenuDto | null> {
  const menus = await sqlClient<MenuRecord[]>`
    SELECT id, menu_date AS "menuDate", is_open AS "isOpen", note,
           order_deadline AS "orderDeadline"
    FROM daily_menus
    WHERE menu_date = ${menuDate}::date
    LIMIT 1
  `
  const menu = menus[0]
  if (!menu) return null
  const [items, categories] = await Promise.all([
    sqlClient<ItemRecord[]>`
    SELECT i.id, i.food_id AS "foodId", f.slug, f.name AS "foodName",
           f.description AS "foodDescription", COALESCE(fi.image_url, f.image_url) AS "imageUrl",
           c.id AS "categoryId", c.title AS "categoryTitle", c.slug AS "categorySlug",
           c.icon AS "categoryIcon", badge.id AS "badgeId", badge.title AS "badgeTitle",
           badge.slug AS "badgeSlug", badge.icon AS "badgeIcon",
           i.price::float8 AS price, i.capacity_portions AS "capacityPortions",
           i.sold_portions AS "soldPortions", i.is_available AS "isAvailable"
    FROM daily_menu_items i
    JOIN foods f ON f.id = i.food_id
    JOIN food_categories c ON c.id = f.category_id
    LEFT JOIN food_tags badge ON badge.id = f.primary_badge_tag_id
      AND badge.is_active = true AND badge.is_customer_visible = true
    LEFT JOIN LATERAL (
      SELECT image_url
      FROM food_images
      WHERE food_id = f.id
      ORDER BY is_primary DESC, display_order, id
      LIMIT 1
    ) fi ON true
    WHERE i.daily_menu_id = ${menu.id}
      AND (${customerVisible} = false OR (f.is_active = true AND c.is_active = true))
    ORDER BY i.id
  `,
    sqlClient<DailyMenuDto['categories']>`
      SELECT id, title, slug, icon, display_order AS "displayOrder"
      FROM food_categories
      WHERE is_active = true
      ORDER BY display_order, id
    `,
  ])
  return {
    id: menu.id,
    menuDate: menu.menuDate,
    isOpen: menu.isOpen,
    note: menu.note,
    orderDeadline: menu.orderDeadline?.toISOString() ?? null,
    categories,
    items: items.map((item) => {
      const {
        categoryId, categoryTitle, categorySlug, categoryIcon,
        badgeId, badgeTitle, badgeSlug, badgeIcon,
        ...rest
      } = item
      return {
        ...rest,
        category: {
          id: categoryId,
          title: categoryTitle,
          slug: categorySlug,
          icon: categoryIcon,
        },
        primaryBadge: badgeId && badgeTitle && badgeSlug
          ? { id: badgeId, title: badgeTitle, slug: badgeSlug, icon: badgeIcon }
          : null,
        remainingPortions: item.capacityPortions - item.soldPortions,
      }
    }),
  }
}

async function ensureMenu(menuDate: string, isOpen = false, note: string | null = null) {
  const rows = await sqlClient<{ id: number }[]>`
    INSERT INTO daily_menus (menu_date, is_open, note, created_at)
    VALUES (${menuDate}::date, ${isOpen}, ${note}, NOW())
    ON CONFLICT (menu_date) DO UPDATE
      SET menu_date = EXCLUDED.menu_date
    RETURNING id
  `
  return rows[0]!.id
}

export async function updateMenuSettings(menuDate: string, request: UpdateDailyMenuSettingsRequest) {
  await ensureMenu(menuDate, request.isOpen, request.note ?? null)
  await sqlClient`
    UPDATE daily_menus
    SET is_open = ${request.isOpen}, note = ${request.note ?? null}
    WHERE menu_date = ${menuDate}::date
  `
  return (await getMenuByDate(menuDate))!
}

export async function addMenuItem(menuDate: string, request: DailyMenuItemWriteRequest) {
  const menuId = await ensureMenu(menuDate)
  const food = await sqlClient<{ id: number }[]>`SELECT id FROM foods WHERE id = ${request.foodId} LIMIT 1`
  if (!food[0]) throw new AppError(`Food with id ${request.foodId} was not found.`)
  try {
    await sqlClient`
      INSERT INTO daily_menu_items
        (daily_menu_id, food_id, price, capacity_portions, sold_portions, is_available, created_at)
      VALUES
        (${menuId}, ${request.foodId}, ${request.price}, ${request.capacityPortions}, 0, ${request.isAvailable}, NOW())
    `
  } catch (error) {
    if (String(error).includes('daily_menu_items_menu_food_uidx')) {
      throw new AppError(`Food id ${request.foodId} already exists in this daily menu.`)
    }
    throw error
  }
  return (await getMenuByDate(menuDate))!
}

export async function updateMenuItem(id: number, request: UpdateDailyMenuItemRequest) {
  const records = await sqlClient<{ menuDate: string; soldPortions: number }[]>`
    SELECT m.menu_date AS "menuDate", i.sold_portions AS "soldPortions"
    FROM daily_menu_items i
    JOIN daily_menus m ON m.id = i.daily_menu_id
    WHERE i.id = ${id}
    LIMIT 1
  `
  const item = records[0]
  if (!item) throw new NotFoundError()
  if (request.capacityPortions < item.soldPortions) {
    throw new AppError('Capacity cannot be less than sold portions.')
  }
  await sqlClient`
    UPDATE daily_menu_items
    SET price = ${request.price},
        capacity_portions = ${request.capacityPortions},
        is_available = ${request.isAvailable}
    WHERE id = ${id}
  `
  return (await getMenuByDate(item.menuDate))!
}

export async function setMenuItemAvailability(id: number, isAvailable: boolean) {
  const result = await sqlClient`UPDATE daily_menu_items SET is_available = ${isAvailable} WHERE id = ${id}`
  if (result.count === 0) throw new NotFoundError()
}

export async function removeMenuItem(id: number) {
  const records = await sqlClient<{ menuDate: string; soldPortions: number; booked: boolean }[]>`
    SELECT m.menu_date AS "menuDate", i.sold_portions AS "soldPortions",
           EXISTS(SELECT 1 FROM order_items oi WHERE oi.daily_menu_item_id = i.id) AS booked
    FROM daily_menu_items i
    JOIN daily_menus m ON m.id = i.daily_menu_id
    WHERE i.id = ${id}
    LIMIT 1
  `
  const item = records[0]
  if (!item) throw new NotFoundError()
  if (item.soldPortions > 0 || item.booked) {
    throw new AppError('Daily menu item cannot be removed because it is used by customer orders.')
  }
  await sqlClient`DELETE FROM daily_menu_items WHERE id = ${id}`
  return (await getMenuByDate(item.menuDate))!
}

export async function replaceMenu(request: DailyMenuWriteRequest) {
  return sqlClient.begin(async (tx) => {
    const existing = await tx<{ id: number; itemCount: number }[]>`
      SELECT m.id, COUNT(i.id)::int AS "itemCount"
      FROM daily_menus m
      LEFT JOIN daily_menu_items i ON i.daily_menu_id = m.id
      WHERE m.menu_date = ${request.menuDate}::date
      GROUP BY m.id
    `
    if (existing[0]?.itemCount && request.items.length === 0) {
      throw new AppError('Daily menu items cannot be cleared by an empty save.')
    }
    const menuRows = await tx<{ id: number }[]>`
      INSERT INTO daily_menus (menu_date, is_open, note, created_at)
      VALUES (${request.menuDate}::date, ${request.isOpen}, ${request.note ?? null}, NOW())
      ON CONFLICT (menu_date) DO UPDATE
        SET is_open = EXCLUDED.is_open, note = EXCLUDED.note
      RETURNING id
    `
    const menuId = menuRows[0]!.id
    const retained: number[] = []
    for (const item of request.items) {
      if (item.id) {
        const updated = await tx<{ id: number }[]>`
          UPDATE daily_menu_items
          SET price = ${item.price}, capacity_portions = ${item.capacityPortions},
              is_available = ${item.isAvailable}
          WHERE id = ${item.id} AND daily_menu_id = ${menuId}
            AND sold_portions <= ${item.capacityPortions}
          RETURNING id
        `
        if (!updated[0]) throw new AppError(`Daily menu item ${item.id} is invalid or capacity is below sold portions.`)
        retained.push(updated[0].id)
      } else {
        const inserted = await tx<{ id: number }[]>`
          INSERT INTO daily_menu_items
            (daily_menu_id, food_id, price, capacity_portions, sold_portions, is_available, created_at)
          VALUES (${menuId}, ${item.foodId}, ${item.price}, ${item.capacityPortions}, 0, ${item.isAvailable}, NOW())
          ON CONFLICT (daily_menu_id, food_id) DO UPDATE
            SET price = EXCLUDED.price,
                capacity_portions = EXCLUDED.capacity_portions,
                is_available = EXCLUDED.is_available
            WHERE daily_menu_items.sold_portions <= EXCLUDED.capacity_portions
          RETURNING id
        `
        if (!inserted[0]) {
          throw new AppError(`Capacity for food ${item.foodId} cannot be below sold portions.`)
        }
        retained.push(inserted[0].id)
      }
    }
    if (retained.length > 0) {
      const removable = await tx<{ id: number }[]>`
        SELECT i.id
        FROM daily_menu_items i
        WHERE i.daily_menu_id = ${menuId}
          AND i.id NOT IN ${tx(retained)}
          AND i.sold_portions = 0
          AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.daily_menu_item_id = i.id)
      `
      if (removable.length > 0) {
        await tx`DELETE FROM daily_menu_items WHERE id IN ${tx(removable.map((item) => item.id))}`
      }
    }
  }).then(() => getMenuByDate(request.menuDate) as Promise<DailyMenuDto>)
}
