import { z } from 'zod'
export * from './social.js'
import { isoDate, timeOfDay } from './delivery.js'
import { PaymentStatus } from './v15.js'
export * from './v15.js'
export * from './delivery.js'

export enum PaymentMethod {
  Cash = 1,
  CardToCard = 2,
  Online = 3,
  Pos = 4,
}

export enum DeliveryMethod {
  Pickup = 1,
  Delivery = 2,
}

export enum OrderStatus {
  PendingConfirmation = 1,
  Confirmed = 2,
  Preparing = 3,
  Ready = 4,
  Delivered = 5,
  Cancelled = 6,
}

export const nullableText = z.string().trim().nullable().optional()

const persianSearchDiacritics = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu
const persianSearchSeparators = /[^\p{L}\p{N}]+/gu

export function normalizePersianSearch(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/ـ/gu, '')
    .replace(persianSearchDiacritics, '')
    .replace(/[\u200c\u200d\u2060\ufeff]/gu, ' ')
    .replace(persianSearchSeparators, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('fa')
}

export const foodTagGroupSchema = z.enum([
  'status', 'protein', 'diet', 'taste', 'serving', 'service', 'style', 'marketing',
])

const publicFoodTagSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  icon: z.string().nullable().optional(),
  group: foodTagGroupSchema,
})

/**
 * `isPersianRice` identifies only the hidden upgrade item. Its price is the upgrade difference, not
 * a full portion. A standalone Persian-rice side is an ordinary customer-visible food with its own
 * full price; both products may share the same recipe ingredient and stock.
 */
export const persianRiceSchema = z.object({
  menuItemId: z.number().int().positive(),
  foodId: z.number().int().positive(),
  title: z.string(),
  imageUrl: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  capacityPortions: z.number().int().nonnegative(),
  soldPortions: z.number().int().nonnegative(),
  remainingPortions: z.number().int(),
  isAvailable: z.boolean(),
})

export const dailyMenuItemSchema = z.object({
  id: z.number().int(),
  foodId: z.number().int(),
  slug: z.string(),
  foodName: z.string(),
  foodDescription: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  category: z.object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
    icon: z.string().nullable().optional(),
  }),
  primaryBadge: z.object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
    icon: z.string().nullable().optional(),
  }).nullable().optional(),
  tags: z.array(publicFoodTagSchema),
  allowsPersianRice: z.boolean().default(false),
  price: z.number().nonnegative(),
  originalPrice: z.number().positive().nullable().optional(),
  discountPercentage: z.number().int().min(1).max(99).nullable().optional(),
  capacityPortions: z.number().int().nonnegative(),
  soldPortions: z.number().int().nonnegative(),
  remainingPortions: z.number().int(),
  isAvailable: z.boolean(),
})

export const dailyMenuSchema = z.object({
  id: z.number().int(),
  menuDate: z.string(),
  isOpen: z.boolean(),
  note: z.string().nullable().optional(),
  orderDeadline: z.string().nullable().optional(),
  categories: z.array(z.object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
    icon: z.string().nullable().optional(),
    displayOrder: z.number().int(),
  })),
  items: z.array(dailyMenuItemSchema),
  persianRice: persianRiceSchema.nullable().default(null),
})

export const publicDailyMenuPageSchema = dailyMenuSchema.extend({
  discountItems: z.array(dailyMenuItemSchema).default([]),
  totalItems: z.number().int().nonnegative(),
  nextCursor: z.number().int().positive().nullable(),
})

export const publicDailyMenuQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  category: z.string().trim().max(100).optional().default(''),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(12),
})

export const menuCartSnapshotRequestSchema = z.object({
  items: z.array(z.object({
    dailyMenuItemId: z.number().int().positive(),
    withPersianRice: z.boolean().default(false),
  })).max(100).refine((values) => new Set(values.map((item) =>
    `${item.dailyMenuItemId}:${item.withPersianRice}`)).size === values.length,
  'گزینه‌های سبد نباید تکراری باشند.'),
})

export const menuCartSnapshotSchema = z.object({
  isOpen: z.boolean(),
  items: z.array(dailyMenuItemSchema.pick({
    id: true,
    foodName: true,
    price: true,
    originalPrice: true,
    discountPercentage: true,
    allowsPersianRice: true,
    remainingPortions: true,
    isAvailable: true,
  })),
  persianRice: persianRiceSchema.nullable().default(null),
})

export const customerAddressSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  city: z.string(),
  addressLine: z.string(),
  isDefault: z.boolean(),
})

export const customerProfileSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  preferredName: z.string(),
  defaultPhoneNumber: z.string(),
  phoneNumberConfirmed: z.boolean().default(false),
  telegramUserId: z.number().int().nullable().optional(),
  telegramUsername: z.string().nullable().optional(),
  addresses: z.array(customerAddressSchema),
})

export const customerSessionSchema = z.object({
  authenticated: z.boolean(),
  method: z.enum(['telegram', 'phone']).nullable(),
  profile: customerProfileSchema.nullable(),
})

export const customerOtpRequestSchema = z.object({
  phoneNumber: z.string().trim().min(1).max(30),
})

export const customerOtpVerifySchema = customerOtpRequestSchema.extend({
  code: z.string().trim()
    .transform((value) => value
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))))
    .refine((value) => /^\d{6}$/.test(value), 'کد تایید باید شش رقم باشد.'),
})

export const customerTelegramLoginSchema = z.object({
  telegramInitData: z.string().trim().min(1),
})

export const customerProfileUpdateSchema = z.object({
  preferredName: z.string().trim().min(2, 'نام باید حداقل دو حرف باشد.').max(150),
})

export const customerAddressWriteSchema = z.object({
  title: z.string().trim().min(1, 'عنوان آدرس الزامی است.').max(100),
  city: z.string().trim().min(1, 'شهر الزامی است.').max(100).default('اندیمشک'),
  addressLine: z.string().trim().min(5, 'نشانی کامل الزامی است.').max(1000),
  isDefault: z.boolean().default(false),
})

export const customerProfileLookupSchema = z.object({
  telegramInitData: z.string().nullable().optional(),
  telegramUserId: z.number().int().nullable().optional(),
  telegramUsername: z.string().nullable().optional(),
})

/**
 * One entry per dish. Persian rice is the only upgrade, so the client just says yes or no; the server
 * resolves today's Persian rice menu item, prices it and expands it into its own order line.
 */
export const createOrderItemSchema = z.object({
  dailyMenuItemId: z.number().int().positive(),
  withPersianRice: z.boolean().default(false),
  quantity: z.number().int().positive(),
})

export const createOrderSchema = z.object({
  telegramInitData: z.string().nullable().optional(),
  telegramUserId: z.number().int().nullable().optional(),
  telegramUsername: z.string().nullable().optional(),
  fullName: z.string().trim().min(1).max(150),
  phoneNumber: z.string().trim().min(1).max(30),
  customerAddressId: z.number().int().positive().nullable().optional(),
  newAddressTitle: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().min(1).max(100).default('اندیمشک'),
  addressLine: z.string().trim().max(1000).nullable().optional(),
  saveAddress: z.boolean().default(true),
  paymentMethod: z.nativeEnum(PaymentMethod),
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  customerNote: z.string().trim().max(1000).nullable().optional(),
  // The client names only the window. The delivery date is derived server-side from the menu the
  // items belong to, so a client cannot pair today's food with tomorrow's delivery. Optional so that
  // Electron manual orders, which are taken by phone, can still be created without one.
  deliveryTimeSlotId: z.number().int().positive().nullable().optional(),
  items: z.array(createOrderItemSchema).min(1),
})

export const orderItemSchema = z.object({
  id: z.number().int(),
  dailyMenuItemId: z.number().int(),
  foodName: z.string(),
  originalUnitPrice: z.number().nonnegative().nullable().optional(),
  unitPrice: z.number(),
  quantity: z.number().int(),
  totalPrice: z.number(),
})

export const orderStatusHistorySchema = z.object({
  fromStatus: z.nativeEnum(OrderStatus),
  toStatus: z.nativeEnum(OrderStatus),
  note: z.string().nullable().optional(),
  changedAt: z.string(),
})

export const orderSchema = z.object({
  id: z.number().int(),
  orderNumber: z.string(),
  customerId: z.number().int(),
  customerFullName: z.string(),
  customerPhoneNumber: z.string(),
  deliveryCity: z.string().optional(),
  addressLine: z.string().nullable().optional(),
  status: z.nativeEnum(OrderStatus),
  paymentMethod: z.nativeEnum(PaymentMethod),
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  subtotalAmount: z.number(),
  deliveryFee: z.number(),
  totalAmount: z.number(),
  customerNote: z.string().nullable().optional(),
  adminNote: z.string().nullable().optional(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  // Snapshot, not a join. Orders placed before delivery windows existed keep these null and must be
  // rendered as «زمان تحویل ثبت نشده» rather than given an invented time.
  deliveryDate: isoDate.nullable().optional(),
  deliveryTimeSlotTitle: z.string().nullable().optional(),
  deliveryStartTime: timeOfDay.nullable().optional(),
  deliveryEndTime: timeOfDay.nullable().optional(),
  items: z.array(orderItemSchema),
  statusHistories: z.array(orderStatusHistorySchema),
})

export const orderReviewWriteSchema = z.object({
  rating: z.number().int().min(1, 'امتیاز باید بین ۱ تا ۵ باشد.').max(5, 'امتیاز باید بین ۱ تا ۵ باشد.'),
  comment: z.string().trim().max(1000, 'نظر نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.').nullable().optional(),
})

export const orderReviewSchema = orderReviewWriteSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

export const customerPaymentDetailSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus),
  amount: z.number().nonnegative(),
  providerName: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export const customerOrderDetailSchema = orderSchema.omit({
  customerId: true,
  adminNote: true,
}).extend({
  deliveryCity: z.string(),
  payments: z.array(customerPaymentDetailSchema),
  review: orderReviewSchema.nullable(),
})

export const orderSummarySchema = z.object({
  id: z.number().int(),
  orderNumber: z.string(),
  customerFullName: z.string(),
  customerPhoneNumber: z.string(),
  status: z.nativeEnum(OrderStatus),
  totalAmount: z.number(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  createdAt: z.string(),
  totalQuantity: z.number().int(),
  foodSummary: z.string(),
  deliveryDate: isoDate.nullable().optional(),
  deliveryTimeSlotTitle: z.string().nullable().optional(),
  deliveryStartTime: timeOfDay.nullable().optional(),
  deliveryEndTime: timeOfDay.nullable().optional(),
})

export const customerOrderSummarySchema = orderSummarySchema.extend({
  deliveryCity: z.string(),
  addressLine: z.string(),
  paymentStatus: z.nativeEnum(PaymentStatus).nullable(),
  statusHistories: z.array(orderStatusHistorySchema),
  review: orderReviewSchema.nullable(),
})

export const customerOrdersPageSchema = z.object({
  items: z.array(customerOrderSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export const foodCategorySchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  icon: z.string().nullable().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const slugSchema = z.string().trim().min(1).max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'عنوان انگلیسی باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.')

export const foodCategoryWriteSchema = z.object({
  title: z.string().trim().min(1, 'عنوان دسته‌بندی الزامی است.').max(100),
  slug: slugSchema.max(100),
  icon: z.string().trim().max(30).nullable().optional(),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
})

export const foodTagSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  icon: z.string().nullable().optional(),
  group: foodTagGroupSchema,
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  isCustomerVisible: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const foodTagWriteSchema = z.object({
  title: z.string().trim().min(1, 'عنوان برچسب الزامی است.').max(100),
  slug: slugSchema.max(100),
  icon: z.string().trim().max(30).nullable().optional(),
  group: foodTagGroupSchema,
  displayOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  isCustomerVisible: z.boolean(),
})

export const foodImageSchema = z.object({
  id: z.number().int(),
  imageUrl: z.string(),
  altText: z.string(),
  displayOrder: z.number().int(),
  isPrimary: z.boolean(),
})

export const foodImageWriteSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().trim().min(1).max(2000),
  altText: z.string().trim().min(1).max(250),
  displayOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
})

export const foodSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  fullDescription: z.string().nullable().optional(),
  ingredients: z.string().nullable().optional(),
  portionDescription: z.string().nullable().optional(),
  allergyInformation: z.string().nullable().optional(),
  preparationTimeMinutes: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive(),
  primaryBadgeTagId: z.number().int().positive().nullable().optional(),
  tagIds: z.array(z.number().int().positive()),
  images: z.array(foodImageSchema),
  defaultPrice: z.number(),
  imageUrl: z.string().nullable().optional(),
  allowsPersianRice: z.boolean().default(false),
  isPersianRice: z.boolean().default(false),
  isActive: z.boolean(),
})

export const foodWriteSchema = z.object({
  name: z.string().trim().min(1, 'عنوان غذا الزامی است.').max(150),
  slug: slugSchema,
  description: z.string().trim().max(300, 'توضیح کوتاه نباید بیشتر از 300 نویسه باشد.').nullable().optional(),
  fullDescription: z.string().trim().max(5000).nullable().optional(),
  ingredients: z.string().trim().max(3000).nullable().optional(),
  portionDescription: z.string().trim().max(500).nullable().optional(),
  allergyInformation: z.string().trim().max(1000).nullable().optional(),
  preparationTimeMinutes: z.number().int().positive('زمان آماده‌سازی باید بیشتر از صفر باشد.').nullable().optional(),
  categoryId: z.number().int().positive('انتخاب دسته‌بندی الزامی است.'),
  tagIds: z.array(z.number().int().positive()).default([])
    .refine((values) => new Set(values).size === values.length, 'برچسب تکراری مجاز نیست.'),
  primaryBadgeTagId: z.number().int().positive().nullable().optional(),
  images: z.array(foodImageWriteSchema).max(10).default([])
    .refine((values) => values.filter((image) => image.isPrimary).length <= 1, 'فقط یک تصویر می‌تواند اصلی باشد.'),
  defaultPrice: z.number().nonnegative(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  allowsPersianRice: z.boolean().default(false),
  isPersianRice: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.primaryBadgeTagId && !value.tagIds.includes(value.primaryBadgeTagId)) {
    context.addIssue({
      code: 'custom',
      path: ['primaryBadgeTagId'],
      message: 'نشان اصلی باید یکی از برچسب‌های انتخاب‌شده باشد.',
    })
  }
  // The hidden Persian-rice upgrade cannot offer itself as another upgrade.
  if (value.isPersianRice && value.allowsPersianRice) {
    context.addIssue({
      code: 'custom',
      path: ['allowsPersianRice'],
      message: 'آیتم «ارتقا به برنج ایرانی» نمی‌تواند خودش گزینه ارتقای برنج داشته باشد.',
    })
  }
})

export const customerIdentitySchema = z.object({
  telegramInitData: z.string().nullable().optional(),
  telegramUserId: z.number().int().nullable().optional(),
  telegramUsername: z.string().nullable().optional(),
})

export const foodDetailSchema = z.object({
  menuItemId: z.number().int().nullable(),
  foodId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  isActive: z.boolean(),
  shortDescription: z.string().nullable(),
  fullDescription: z.string().nullable(),
  category: foodCategorySchema.pick({ id: true, title: true, slug: true, icon: true }),
  tags: z.array(foodTagSchema.pick({ id: true, title: true, slug: true, icon: true, group: true })),
  allowsPersianRice: z.boolean().default(false),
  persianRice: persianRiceSchema.nullable().default(null),
  primaryBadge: foodTagSchema.pick({ id: true, title: true, slug: true, icon: true }).nullable(),
  images: z.array(foodImageSchema),
  ingredients: z.string().nullable(),
  portionDescription: z.string().nullable(),
  allergyInformation: z.string().nullable(),
  preparationTimeMinutes: z.number().int().positive().nullable(),
  price: z.number().nullable(),
  originalPrice: z.number().positive().nullable().optional(),
  discountPercentage: z.number().int().min(1).max(99).nullable().optional(),
  menuDate: z.string().nullable(),
  remainingCapacity: z.number().int().nonnegative(),
  orderDeadline: z.string().nullable(),
  isOrderable: z.boolean(),
  availabilityReason: z.string(),
  likeCount: z.number().int().nonnegative(),
  isLikedByCurrentUser: z.boolean(),
  isFavoriteByCurrentUser: z.boolean(),
  relatedFoods: z.array(z.object({
    menuItemId: z.number().int(),
    slug: z.string(),
    title: z.string(),
    imageUrl: z.string().nullable(),
    price: z.number(),
    originalPrice: z.number().positive().nullable().optional(),
    discountPercentage: z.number().int().min(1).max(99).nullable().optional(),
    primaryBadge: z.object({ title: z.string(), icon: z.string().nullable() }).nullable(),
    // Lets the suggestion chip warn that this dish still needs a rice choice added on top.
    allowsPersianRice: z.boolean().default(false),
  })),
})

export const foodInteractionResponseSchema = z.object({
  likeCount: z.number().int().nonnegative(),
  isLikedByCurrentUser: z.boolean(),
  isFavoriteByCurrentUser: z.boolean(),
})

export const favoriteFoodSchema = z.object({
  foodId: z.number().int(),
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string().nullable(),
  imageUrl: z.string().nullable(),
  categoryTitle: z.string(),
})

export const dailyMenuItemWriteSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  foodId: z.number().int().positive(),
  price: z.number().nonnegative(),
  discountPrice: z.number().positive().nullable().optional(),
  capacityPortions: z.number().int().nonnegative(),
  isAvailable: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.discountPrice != null && value.discountPrice >= value.price) {
    context.addIssue({
      code: 'custom',
      path: ['discountPrice'],
      message: 'قیمت تخفیف باید از قیمت اصلی کمتر باشد.',
    })
  }
})

export const dailyMenuWriteSchema = z.object({
  menuDate: z.string(),
  isOpen: z.boolean(),
  note: z.string().max(1000).nullable().optional(),
  items: z.array(dailyMenuItemWriteSchema),
})

export const updateDailyMenuItemSchema = z.object({
  price: z.number().nonnegative(),
  discountPrice: z.number().positive().nullable().optional(),
  capacityPortions: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
}).superRefine((value, context) => {
  if (value.discountPrice != null && value.discountPrice >= value.price) {
    context.addIssue({
      code: 'custom',
      path: ['discountPrice'],
      message: 'قیمت تخفیف باید از قیمت اصلی کمتر باشد.',
    })
  }
})

export const updateDailyMenuSettingsSchema = z.object({
  isOpen: z.boolean(),
  note: z.string().max(1000).nullable().optional(),
})

export const updateOrderStatusSchema = z.object({
  newStatus: z.nativeEnum(OrderStatus),
  adminNote: z.string().max(1000).nullable().optional(),
  statusNote: z.string().max(1000).nullable().optional(),
})

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export const adminLoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresAtUtc: z.string(),
  username: z.string(),
  fullName: z.string(),
  roles: z.array(z.string()),
})

export const dashboardSummarySchema = z.object({
  date: z.string(),
  totalOrders: z.number().int(),
  pendingOrders: z.number().int(),
  confirmedOrders: z.number().int(),
  preparingOrders: z.number().int(),
  readyOrders: z.number().int(),
  deliveredOrders: z.number().int(),
  cancelledOrders: z.number().int(),
  activeOrders: z.number().int(),
  totalPortions: z.number().int(),
  grossSales: z.number(),
  confirmedSales: z.number(),
  deliveredSales: z.number(),
  todayMenuItems: z.number().int(),
  isTodayMenuOpen: z.boolean(),
})

export const analyticsHeartbeatSchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
})

export const analyticsHeartbeatResponseSchema = analyticsHeartbeatSchema.extend({
  trackedAt: z.string(),
})

export const customerAnalyticsTodaySchema = z.object({
  uniqueVisitorsToday: z.number().int().nonnegative(),
  onlineNow: z.number().int().nonnegative(),
  guestVisitorsToday: z.number().int().nonnegative(),
  authenticatedUsersToday: z.number().int().nonnegative(),
  newUsersToday: z.number().int().nonnegative(),
  returningUsersToday: z.number().int().nonnegative(),
  sessionsToday: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
  calculatedAt: z.string(),
})

export type DailyMenuDto = z.infer<typeof dailyMenuSchema>
export type DailyMenuItemDto = z.infer<typeof dailyMenuItemSchema>
export type PublicDailyMenuPageDto = z.infer<typeof publicDailyMenuPageSchema>
export type PublicDailyMenuQuery = z.infer<typeof publicDailyMenuQuerySchema>
export type MenuCartSnapshotDto = z.infer<typeof menuCartSnapshotSchema>
export type MenuCartSnapshotRequest = z.infer<typeof menuCartSnapshotRequestSchema>
export type PersianRiceDto = z.infer<typeof persianRiceSchema>
export type CustomerAddressDto = z.infer<typeof customerAddressSchema>
export type CustomerProfileDto = z.infer<typeof customerProfileSchema>
export type CustomerSessionDto = z.infer<typeof customerSessionSchema>
export type CustomerOtpRequest = z.infer<typeof customerOtpRequestSchema>
export type CustomerOtpVerifyRequest = z.infer<typeof customerOtpVerifySchema>
export type CustomerTelegramLoginRequest = z.infer<typeof customerTelegramLoginSchema>
export type CustomerProfileUpdateRequest = z.infer<typeof customerProfileUpdateSchema>
export type CustomerAddressWriteRequest = z.infer<typeof customerAddressWriteSchema>
export type CustomerOrdersPageDto = z.infer<typeof customerOrdersPageSchema>
export type CustomerOrderDetailDto = z.infer<typeof customerOrderDetailSchema>
export type CustomerOrderSummaryDto = z.infer<typeof customerOrderSummarySchema>
export type CustomerPaymentDetailDto = z.infer<typeof customerPaymentDetailSchema>
export type OrderReviewDto = z.infer<typeof orderReviewSchema>
export type OrderReviewWriteRequest = z.infer<typeof orderReviewWriteSchema>
export type CustomerProfileLookupRequest = z.infer<typeof customerProfileLookupSchema>
export type CreateOrderRequest = z.infer<typeof createOrderSchema>
export type OrderDto = z.infer<typeof orderSchema>
export type OrderSummaryDto = z.infer<typeof orderSummarySchema>
export type FoodDto = z.infer<typeof foodSchema>
export type FoodWriteRequest = z.infer<typeof foodWriteSchema>
export type FoodCategoryDto = z.infer<typeof foodCategorySchema>
export type FoodCategoryWriteRequest = z.infer<typeof foodCategoryWriteSchema>
export type FoodTagDto = z.infer<typeof foodTagSchema>
export type FoodTagWriteRequest = z.infer<typeof foodTagWriteSchema>
export type FoodImageDto = z.infer<typeof foodImageSchema>
export type FoodImageWriteRequest = z.infer<typeof foodImageWriteSchema>
export type CustomerIdentityRequest = z.infer<typeof customerIdentitySchema>
export type FoodDetailDto = z.infer<typeof foodDetailSchema>
export type FoodInteractionResponse = z.infer<typeof foodInteractionResponseSchema>
export type FavoriteFoodDto = z.infer<typeof favoriteFoodSchema>
export type DailyMenuWriteRequest = z.infer<typeof dailyMenuWriteSchema>
export type DailyMenuItemWriteRequest = z.infer<typeof dailyMenuItemWriteSchema>
export type UpdateDailyMenuItemRequest = z.infer<typeof updateDailyMenuItemSchema>
export type UpdateDailyMenuSettingsRequest = z.infer<typeof updateDailyMenuSettingsSchema>
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>
export type AdminLoginRequest = z.infer<typeof adminLoginSchema>
export type AdminLoginResponse = z.infer<typeof adminLoginResponseSchema>
export type AdminDashboardSummaryDto = z.infer<typeof dashboardSummarySchema>
export type AnalyticsHeartbeatRequest = z.infer<typeof analyticsHeartbeatSchema>
export type AnalyticsHeartbeatResponse = z.infer<typeof analyticsHeartbeatResponseSchema>
export type CustomerAnalyticsTodayDto = z.infer<typeof customerAnalyticsTodaySchema>

export interface OrderReportQuery {
  date: string
  status?: OrderStatus
  orderNumber?: string
  customerName?: string
  phoneNumber?: string
  deliveryMethod?: DeliveryMethod
  paymentMethod?: PaymentMethod
  foodName?: string
}

/**
 * One line per dish. The same dish with and without the Persian rice upgrade are two separate lines;
 * when the upgrade is on, it is shown as its own row and becomes its own order line, but its quantity
 * always follows the dish. `persianRicePrice` is a cached display value, refreshed on reconciliation.
 */
export interface CartItem {
  dailyMenuItemId: number
  withPersianRice?: boolean
  persianRiceTitle?: string | null
  persianRicePrice?: number
  foodName: string
  unitPrice: number
  originalUnitPrice?: number | null
  discountPercentage?: number | null
  quantity: number
  remainingPortions: number
}
