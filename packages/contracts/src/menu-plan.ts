import { z } from 'zod'
import { isoDate } from './delivery.js'

/**
 * The rest of the Persian month, one entry per day, so a customer can see what is coming rather than
 * only what is cookable today. A day the kitchen has not planned yet is still listed: an absent row
 * would read as "nothing on that day", which is a different statement from "not decided yet".
 */
export const menuPlanFoodSchema = z.object({
  foodId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  price: z.number().nonnegative(),
})

export const menuPlanDaySchema = z.object({
  date: isoDate,
  /** True for the business day the customer is living in, which is the only orderable one. */
  isToday: z.boolean(),
  /** A menu row exists for this date. */
  isPlanned: z.boolean(),
  /** The operator has opened that menu for orders. */
  isOpen: z.boolean(),
  foodCount: z.number().int().nonnegative(),
  /** A short preview, not the whole menu: enough to recognise the day. */
  foods: z.array(menuPlanFoodSchema),
  lowestPrice: z.number().nonnegative().nullable(),
  note: z.string().nullable(),
})

export const menuPlanSchema = z.object({
  /** Jalali month the plan covers, as «شهریور ۱۴۰۵». */
  monthTitle: z.string(),
  fromDate: isoDate,
  toDate: isoDate,
  days: z.array(menuPlanDaySchema),
})

export type MenuPlanFoodDto = z.infer<typeof menuPlanFoodSchema>
export type MenuPlanDayDto = z.infer<typeof menuPlanDaySchema>
export type MenuPlanDto = z.infer<typeof menuPlanSchema>
