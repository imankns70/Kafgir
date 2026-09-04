import type { MenuPlanDayDto, MenuPlanDto, MenuPlanFoodDto } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { currentJalaliMonth, jalaliMonthRange } from '../domain/jalali-month'
import { businessDate } from '../time'

/** How many foods a day card shows before it starts counting the rest. */
const previewSize = 4

type PlannedDayRow = {
  menuDate: string
  isOpen: boolean
  note: string | null
  foodCount: number
  lowestPrice: number | null
  foods: MenuPlanFoodDto[] | null
}

/** Every ISO day from `from` to `to`, inclusive. The plan lists days, not menus. */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const last = new Date(`${to}T00:00:00Z`)
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/**
 * What the kitchen has planned for the rest of the Persian month.
 *
 * The range starts at today rather than at the first of the month: a customer plans forwards, and a
 * card for a day that has already passed is a card they can do nothing with. Days with no menu row
 * are still returned, because "not decided yet" and "nothing that day" read the same to a customer
 * only if the day is missing entirely.
 *
 * Visibility matches the customer menu: an inactive food or an inactive category is not on the plan.
 */
export async function getMenuPlan(now = new Date()): Promise<MenuPlanDto> {
  const today = businessDate(now)
  const { year, month } = currentJalaliMonth(now)
  const { title, toDate } = jalaliMonthRange(year, month)
  // A business day past the month's last date only happens around midnight on the final day; the
  // plan then covers that one remaining day rather than an empty range.
  const lastDate = toDate < today ? today : toDate

  const rows = await sqlClient<PlannedDayRow[]>`
    SELECT m.menu_date::text AS "menuDate", m.is_open AS "isOpen", m.note,
           COALESCE(counted.total, 0)::int AS "foodCount",
           counted.lowest::float8 AS "lowestPrice",
           preview.items AS foods
    FROM daily_menus m
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total, MIN(COALESCE(i.discount_price, i.price)) AS lowest
      FROM daily_menu_items i
      JOIN foods f ON f.id = i.food_id
      JOIN food_categories c ON c.id = f.category_id
      WHERE i.daily_menu_id = m.id AND f.is_active AND c.is_active AND NOT f.is_persian_rice
    ) counted ON true
    LEFT JOIN LATERAL (
      SELECT json_agg(item ORDER BY item.ord) AS items
      FROM (
        SELECT i.id AS ord, f.id AS "foodId", f.slug, f.name AS title,
               COALESCE(fi.image_url, f.image_url) AS "imageUrl",
               COALESCE(i.discount_price, i.price)::float8 AS price
        FROM daily_menu_items i
        JOIN foods f ON f.id = i.food_id
        JOIN food_categories c ON c.id = f.category_id
        LEFT JOIN LATERAL (
          SELECT image_url FROM food_images WHERE food_id = f.id
          ORDER BY display_order, id LIMIT 1
        ) fi ON true
        WHERE i.daily_menu_id = m.id AND f.is_active AND c.is_active AND NOT f.is_persian_rice
        ORDER BY i.id
        LIMIT ${previewSize}
      ) item
    ) preview ON true
    WHERE m.menu_date >= ${today}::date AND m.menu_date <= ${lastDate}::date
    ORDER BY m.menu_date
  `

  const planned = new Map(rows.map((row) => [row.menuDate, row]))
  const days: MenuPlanDayDto[] = daysBetween(today, lastDate).map((date) => {
    const row = planned.get(date)
    return {
      date,
      isToday: date === today,
      isPlanned: Boolean(row),
      isOpen: Boolean(row?.isOpen),
      foodCount: row?.foodCount ?? 0,
      // `ord` is only there to order the preview; it never reaches the customer.
      foods: (row?.foods ?? []).map(({ foodId, slug, title: name, imageUrl, price }) => ({
        foodId, slug, title: name, imageUrl: imageUrl ?? null, price,
      })),
      lowestPrice: row?.lowestPrice ?? null,
      note: row?.note ?? null,
    }
  })

  return { monthTitle: title, fromDate: today, toDate: lastDate, days }
}
