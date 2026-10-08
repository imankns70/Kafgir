import { z } from 'zod'
import { isoDate } from './delivery.js'
import { customerChannelSchema } from './customer-report.js'
import { OrderStatus } from './order-enums.js'

/**
 * Looking a customer up and reading their history.
 *
 * Separate from the customer *report*: the report ranks and aggregates a cohort over a range, this
 * finds one person and shows everything Kafgir knows about them. They share the channel and money
 * conventions — revenue counts delivered orders, order counts exclude cancellations — so the two
 * screens never disagree about the same customer.
 */

/** What the operator is looking for, beyond a name or number. */
export const customerActivityFilterSchema = z.enum([
  'all',
  /** Has never placed a non-cancelled order. */
  'never-ordered',
  /** Has at least one non-cancelled order. */
  'has-ordered',
  /** Ordered before, but nothing recently — the churn list. */
  'lapsed',
  /** Has an order that is still in flight. */
  'active-order',
])

export const customerSortSchema = z.enum(['lastOrder', 'totalSpent', 'orderCount', 'joined', 'name'])

export const customerDirectoryQuerySchema = z.object({
  /** Free text matched against the preferred name and the phone number. */
  search: z.string().trim().max(120).nullable().optional(),
  /**
   * Given name and family name, matched separately.
   *
   * Kafgir stores one `preferred_name`, so the family part is everything after the first space and a
   * single-token name has none. Matching folds Persian spelling variants — `ی`/`ي`, `ک`/`ك` and the
   * zero-width non-joiner — so «علی‌پور» and «علی پور» find the same customer.
   */
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  channel: customerChannelSchema.nullable().optional(),
  joinedFrom: isoDate.nullable().optional(),
  joinedTo: isoDate.nullable().optional(),
  activity: customerActivityFilterSchema.default('all'),
  /** Days of silence that count as lapsed. Only read when `activity` is `lapsed`. */
  lapsedDays: z.number().int().min(1).max(3650).default(60),
  minOrders: z.number().int().min(0).max(10_000).nullable().optional(),
  minSpent: z.number().min(0).nullable().optional(),
  /** Matched against saved addresses and the city recorded on past orders. */
  city: z.string().trim().max(100).nullable().optional(),
  /** One of the business's own customer tags, matched exactly. */
  tag: z.string().trim().max(30).nullable().optional(),
  /** Only customers who are blocked from ordering in the customer app. */
  blockedOnly: z.boolean().default(false),
  sort: customerSortSchema.default('lastOrder'),
  page: z.number().int().min(1).default(1),
  // Upper bound matches the largest option the admin pager offers.
  pageSize: z.number().int().min(10).max(1000).default(10),
})

export const customerDirectoryRowSchema = z.object({
  customerProfileId: z.number().int().positive(),
  preferredName: z.string(),
  phoneNumber: z.string(),
  channel: customerChannelSchema,
  joinedAt: z.string(),
  orderCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  totalSpent: z.number().nonnegative(),
  lastOrderAt: z.string().nullable(),
  hasActiveOrder: z.boolean(),
  city: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  isBlocked: z.boolean().default(false),
})

export const customerDirectoryPageSchema = z.object({
  items: z.array(customerDirectoryRowSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

/** One line of the customer's order history. */
export const customerHistoryOrderSchema = z.object({
  id: z.number().int().positive(),
  orderNumber: z.string(),
  status: z.nativeEnum(OrderStatus),
  createdAt: z.string(),
  totalAmount: z.number(),
  itemSummary: z.string(),
  deliveryDate: z.string().nullable(),
  deliveryWindow: z.string().nullable(),
  deliveryCity: z.string(),
  addressLine: z.string(),
})

export const customerHistoryReviewSchema = z.object({
  orderId: z.number().int().positive(),
  orderNumber: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string(),
})

export const customerHistoryAddressSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  city: z.string(),
  addressLine: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  lastUsedAt: z.string().nullable(),
})

export const customerDetailSchema = z.object({
  customerProfileId: z.number().int().positive(),
  preferredName: z.string(),
  phoneNumber: z.string(),
  channel: customerChannelSchema,
  telegramUsername: z.string().nullable(),
  joinedAt: z.string(),
  /** The business's private note and tags; never shown to the customer. */
  adminNote: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  blockedAt: z.string().nullable().default(null),
  blockedReason: z.string().nullable().default(null),
  /** Lifetime figures, not bounded by any range. */
  totals: z.object({
    orderCount: z.number().int().nonnegative(),
    deliveredCount: z.number().int().nonnegative(),
    cancelledCount: z.number().int().nonnegative(),
    totalSpent: z.number().nonnegative(),
    averageOrderValue: z.number().nonnegative(),
    firstOrderAt: z.string().nullable(),
    lastOrderAt: z.string().nullable(),
    reviewCount: z.number().int().nonnegative(),
    averageRating: z.number().nullable(),
    supportConversationCount: z.number().int().nonnegative(),
  }),
  addresses: z.array(customerHistoryAddressSchema),
  orders: z.array(customerHistoryOrderSchema),
  reviews: z.array(customerHistoryReviewSchema),
  /** Orders are capped; the UI says so when the cap is reached. */
  orderLimit: z.number().int().positive(),
})

export type CustomerActivityFilter = z.infer<typeof customerActivityFilterSchema>
export type CustomerSort = z.infer<typeof customerSortSchema>
export type CustomerDirectoryQuery = z.infer<typeof customerDirectoryQuerySchema>
export type CustomerDirectoryRowDto = z.infer<typeof customerDirectoryRowSchema>
export type CustomerDirectoryPageDto = z.infer<typeof customerDirectoryPageSchema>
export type CustomerHistoryOrderDto = z.infer<typeof customerHistoryOrderSchema>
export type CustomerHistoryReviewDto = z.infer<typeof customerHistoryReviewSchema>
export type CustomerHistoryAddressDto = z.infer<typeof customerHistoryAddressSchema>
export type CustomerDetailDto = z.infer<typeof customerDetailSchema>

const customerTag = z.string().trim().min(1).max(30).regex(/^[^,،]+$/u, 'برچسب نباید ویرگول داشته باشد.')

/** What an operator may change about a customer: the note, the tags and whether they may order. */
export const customerCrmWriteSchema = z.object({
  adminNote: z.string().trim().max(2000).nullable(),
  tags: z.array(customerTag).max(12).transform((tags) => [...new Set(tags)]),
  blocked: z.boolean(),
  blockedReason: z.string().trim().max(500).nullable().optional(),
}).refine((value) => !value.blocked || Boolean(value.blockedReason?.trim()), {
  message: 'برای مسدود کردن، دلیل را بنویسید.', path: ['blockedReason'],
})

export type CustomerCrmWriteRequest = z.infer<typeof customerCrmWriteSchema>
