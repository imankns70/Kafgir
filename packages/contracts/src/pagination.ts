import { z } from 'zod'

/**
 * One pagination convention for the whole admin application.
 *
 * Pages are **1-based** everywhere — in the UI, across IPC, and in the service layer. The only place
 * a zero-based number exists is the SQL `OFFSET`, computed once in `server-core/db/paginate.ts`.
 * Keeping the conversion in exactly one place is what prevents the off-by-one that shows page 2's
 * rows under page 1's label.
 */

/** Row counts the admin offers. 10 is the default so a grid never opens as a wall of rows. */
export const pageSizeOptions = [10, 25, 50, 100, 500, 1000] as const

export const defaultPageSize = 10

/** The largest option, so a caller cannot ask for more than the UI can offer. */
export const maxPageSize = 1000

export const pageRequestSchema = z.object({
  page: z.number().int().min(1).catch(1).default(1),
  pageSize: z.number().int().min(1).max(maxPageSize).catch(defaultPageSize).default(defaultPageSize),
})

export type PageRequest = z.infer<typeof pageRequestSchema>

export const sortDirectionSchema = z.enum(['asc', 'desc'])
export type SortDirection = z.infer<typeof sortDirectionSchema>

/**
 * What every paginated query returns.
 *
 * `totalItems` counts rows matching the *same* filters as the page query, never the whole table —
 * a count that ignores the filter is the bug that makes "۳ نتیجه" sit under "صفحه ۱ از ۵۰".
 */
export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

/** Builds the Zod schema for a paged envelope around any item schema. */
export const pagedSchema = <T extends z.ZodTypeAny>(item: T) => z.object({
  items: z.array(item),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})
