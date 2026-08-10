import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
  bigint,
  check,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core'

const utcTimestamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: 'number' })
const quantity = (name: string) => numeric(name, { precision: 20, scale: 6, mode: 'string' })

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }),
  normalizedName: varchar('normalized_name', { length: 256 }),
  concurrencyStamp: text('concurrency_stamp'),
}, (table) => [
  uniqueIndex('roles_normalized_name_uidx').on(table.normalizedName),
])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 256 }),
  normalizedUsername: varchar('normalized_username', { length: 256 }),
  email: varchar('email', { length: 256 }),
  normalizedEmail: varchar('normalized_email', { length: 256 }),
  emailConfirmed: boolean('email_confirmed').notNull().default(false),
  passwordHash: text('password_hash'),
  passwordHashScheme: varchar('password_hash_scheme', { length: 40 }).notNull().default('aspnet-identity-v3'),
  securityStamp: text('security_stamp'),
  concurrencyStamp: text('concurrency_stamp'),
  phoneNumber: varchar('phone_number', { length: 30 }),
  phoneNumberConfirmed: boolean('phone_number_confirmed').notNull().default(false),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  lockoutEnd: utcTimestamp('lockout_end'),
  lockoutEnabled: boolean('lockout_enabled').notNull().default(true),
  accessFailedCount: integer('access_failed_count').notNull().default(0),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
  telegramFirstName: varchar('telegram_first_name', { length: 150 }),
  telegramLastName: varchar('telegram_last_name', { length: 150 }),
  telegramLanguageCode: varchar('telegram_language_code', { length: 20 }),
  allowsWriteToPm: boolean('allows_write_to_pm').notNull().default(false),
  fullName: varchar('full_name', { length: 150 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  lastSeenAt: utcTimestamp('last_seen_at'),
  lastOrderAt: utcTimestamp('last_order_at'),
}, (table) => [
  uniqueIndex('users_normalized_username_uidx').on(table.normalizedUsername),
  index('users_normalized_email_idx').on(table.normalizedEmail),
  uniqueIndex('users_telegram_user_id_uidx').on(table.telegramUserId).where(sql`telegram_user_id IS NOT NULL`),
])

export const userRoles = pgTable('user_roles', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ name: 'user_roles_pk', columns: [table.userId, table.roleId] }),
  index('user_roles_role_id_idx').on(table.roleId),
])

export const userClaims = pgTable('user_claims', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimType: text('claim_type'),
  claimValue: text('claim_value'),
})

export const roleClaims = pgTable('role_claims', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  claimType: text('claim_type'),
  claimValue: text('claim_value'),
})

export const userLogins = pgTable('user_logins', {
  loginProvider: varchar('login_provider', { length: 128 }).notNull(),
  providerKey: varchar('provider_key', { length: 128 }).notNull(),
  providerDisplayName: text('provider_display_name'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ name: 'user_logins_pk', columns: [table.loginProvider, table.providerKey] }),
])

export const userTokens = pgTable('user_tokens', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  loginProvider: varchar('login_provider', { length: 128 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  value: text('value'),
}, (table) => [
  primaryKey({ name: 'user_tokens_pk', columns: [table.userId, table.loginProvider, table.name] }),
])

export const telegramAccounts = pgTable('telegram_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
  username: varchar('username', { length: 100 }),
  firstName: varchar('first_name', { length: 150 }),
  lastName: varchar('last_name', { length: 150 }),
  languageCode: varchar('language_code', { length: 20 }),
  allowsWriteToPm: boolean('allows_write_to_pm').notNull().default(false),
  chatId: varchar('chat_id', { length: 120 }).notNull(),
  createdAt: utcTimestamp('created_at').notNull(),
  lastSeenAt: utcTimestamp('last_seen_at'),
}, (table) => [
  uniqueIndex('telegram_accounts_user_id_uidx').on(table.userId),
  uniqueIndex('telegram_accounts_telegram_user_id_uidx').on(table.telegramUserId),
  index('telegram_accounts_chat_id_idx').on(table.chatId),
])

export const customerProfiles = pgTable('customer_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  preferredName: varchar('preferred_name', { length: 150 }).notNull(),
  defaultPhoneNumber: varchar('default_phone_number', { length: 30 }).notNull(),
  createdAt: utcTimestamp('created_at').notNull(),
  lastOrderAt: utcTimestamp('last_order_at'),
}, (table) => [
  uniqueIndex('customer_profiles_user_id_uidx').on(table.userId),
])

export const customerLoginPhones = pgTable('customer_login_phones', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  normalizedPhoneNumber: varchar('normalized_phone_number', { length: 11 }).notNull(),
  verifiedAt: utcTimestamp('verified_at').notNull(),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('customer_login_phones_user_id_uidx').on(table.userId),
  uniqueIndex('customer_login_phones_phone_uidx').on(table.normalizedPhoneNumber),
])

export const customerOtpChallenges = pgTable('customer_otp_challenges', {
  id: serial('id').primaryKey(),
  normalizedPhoneNumber: varchar('normalized_phone_number', { length: 11 }).notNull(),
  codeDigest: varchar('code_digest', { length: 128 }).notNull(),
  requestIpDigest: varchar('request_ip_digest', { length: 128 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: utcTimestamp('expires_at').notNull(),
  consumedAt: utcTimestamp('consumed_at'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('customer_otp_phone_created_idx').on(table.normalizedPhoneNumber, table.createdAt),
  index('customer_otp_ip_created_idx').on(table.requestIpDigest, table.createdAt),
  check('customer_otp_attempts_check', sql`${table.attempts} >= 0 AND ${table.attempts} <= 5`),
])

export const analyticsSessions = pgTable('analytics_sessions', {
  id: uuid('id').primaryKey(),
  visitorId: uuid('visitor_id').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  startedAt: utcTimestamp('started_at').notNull(),
  lastSeenAt: utcTimestamp('last_seen_at').notNull(),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('analytics_sessions_last_seen_idx').on(table.lastSeenAt),
  index('analytics_sessions_started_idx').on(table.startedAt),
  index('analytics_sessions_visitor_last_seen_idx').on(table.visitorId, table.lastSeenAt),
  index('analytics_sessions_user_last_seen_idx').on(table.lastSeenAt, table.userId)
    .where(sql`user_id IS NOT NULL`),
])

export const customerAddresses = pgTable('customer_addresses', {
  id: serial('id').primaryKey(),
  customerProfileId: integer('customer_profile_id').notNull().references(() => customerProfiles.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  addressLine: varchar('address_line', { length: 1000 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  lastUsedAt: utcTimestamp('last_used_at'),
}, (table) => [
  index('customer_addresses_profile_idx').on(table.customerProfileId),
])

export const foodCategories = pgTable('food_categories', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 30 }),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('food_categories_slug_uidx').on(table.slug),
  index('food_categories_active_order_idx').on(table.isActive, table.displayOrder),
])

export const foodTags = pgTable('food_tags', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 30 }),
  group: varchar('group_name', { length: 40 }).notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  isCustomerVisible: boolean('is_customer_visible').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('food_tags_slug_uidx').on(table.slug),
  index('food_tags_group_order_idx').on(table.group, table.displayOrder),
])

export const foods = pgTable('foods', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 180 }).notNull(),
  description: varchar('description', { length: 1000 }),
  fullDescription: text('full_description'),
  ingredients: text('ingredients'),
  portionDescription: varchar('portion_description', { length: 500 }),
  allergyInformation: varchar('allergy_information', { length: 1000 }),
  preparationTimeMinutes: integer('preparation_time_minutes'),
  categoryId: integer('category_id').notNull().references(() => foodCategories.id, { onDelete: 'restrict' }),
  primaryBadgeTagId: integer('primary_badge_tag_id').references(() => foodTags.id, { onDelete: 'set null' }),
  defaultPrice: money('default_price').notNull().default(0),
  imageUrl: varchar('image_url', { length: 2000 }),
  // Every dish includes foreign rice in its price. This offers the paid Persian rice upgrade.
  allowsPersianRice: boolean('allows_persian_rice').notNull().default(false),
  // Marks the one purchasable Persian rice food: hidden from the customer grid and offered only as
  // the upgrade on dishes that allow it.
  isPersianRice: boolean('is_persian_rice').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('foods_slug_uidx').on(table.slug),
  uniqueIndex('foods_name_normalized_uidx').on(sql`lower(btrim(${table.name}))`),
  index('foods_category_id_idx').on(table.categoryId),
  uniqueIndex('foods_persian_rice_uidx').on(table.isPersianRice)
    .where(sql`${table.isPersianRice} AND ${table.isActive}`),
  check('foods_persian_rice_role_check', sql`NOT (${table.isPersianRice} AND ${table.allowsPersianRice})`),
  check('foods_preparation_time_check', sql`${table.preparationTimeMinutes} IS NULL OR ${table.preparationTimeMinutes} > 0`),
])

export const foodToTags = pgTable('food_to_tags', {
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => foodTags.id, { onDelete: 'cascade' }),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  primaryKey({ name: 'food_to_tags_pk', columns: [table.foodId, table.tagId] }),
  index('food_to_tags_tag_id_idx').on(table.tagId),
])

export const foodImages = pgTable('food_images', {
  id: serial('id').primaryKey(),
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
  imageUrl: varchar('image_url', { length: 2000 }).notNull(),
  altText: varchar('alt_text', { length: 250 }).notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('food_images_food_order_idx').on(table.foodId, table.displayOrder),
  uniqueIndex('food_images_one_primary_uidx').on(table.foodId).where(sql`is_primary = true`),
])

export const foodLikes = pgTable('food_likes', {
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  primaryKey({ name: 'food_likes_pk', columns: [table.userId, table.foodId] }),
  index('food_likes_food_id_idx').on(table.foodId),
])

export const foodFavorites = pgTable('food_favorites', {
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  primaryKey({ name: 'food_favorites_pk', columns: [table.userId, table.foodId] }),
  index('food_favorites_food_id_idx').on(table.foodId),
])

export const dailyMenus = pgTable('daily_menus', {
  id: serial('id').primaryKey(),
  menuDate: date('menu_date', { mode: 'string' }).notNull(),
  isOpen: boolean('is_open').notNull().default(false),
  note: varchar('note', { length: 1000 }),
  orderDeadline: utcTimestamp('order_deadline'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('daily_menus_date_uidx').on(table.menuDate),
])

export const dailyMenuItems = pgTable('daily_menu_items', {
  id: serial('id').primaryKey(),
  dailyMenuId: integer('daily_menu_id').notNull().references(() => dailyMenus.id, { onDelete: 'cascade' }),
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'restrict' }),
  price: money('price').notNull(),
  discountPrice: money('discount_price'),
  capacityPortions: integer('capacity_portions').notNull(),
  soldPortions: integer('sold_portions').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('daily_menu_items_menu_food_uidx').on(table.dailyMenuId, table.foodId),
  check('daily_menu_items_capacity_check', sql`${table.capacityPortions} >= 0`),
  check('daily_menu_items_sold_check', sql`${table.soldPortions} >= 0 AND ${table.soldPortions} <= ${table.capacityPortions}`),
  check('daily_menu_items_price_check', sql`${table.price} >= 0`),
  check('daily_menu_items_discount_price_check', sql`${table.discountPrice} IS NULL OR (${table.discountPrice} > 0 AND ${table.discountPrice} < ${table.price})`),
])

// Delivery windows are master data, edited rarely and reused every day. `start_time`/`end_time` are
// real `time` values so ordering, cutoff arithmetic and kitchen sorting happen in PostgreSQL rather
// than over display strings. The cutoff lives here because a noon window and an evening window close
// at different lead times; `daily_menus.order_deadline` still gates the menu as a whole.
export const deliveryTimeSlots = pgTable('delivery_time_slots', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  orderCutoffMinutesBeforeStart: integer('order_cutoff_minutes_before_start').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at'),
}, (table) => [
  check('delivery_time_slots_range_check', sql`${table.startTime} < ${table.endTime}`),
  check('delivery_time_slots_cutoff_check', sql`${table.orderCutoffMinutesBeforeStart} >= 0`),
  index('delivery_time_slots_active_sort_idx').on(table.isActive, table.sortOrder),
])

// A row here is an override for one date, not a requirement. Absent row means the slot behaves per
// its master `is_active` with no slot-level capacity limit, so operators never have to populate a
// calendar just to keep ordinary days working.
export const deliveryTimeSlotAvailabilities = pgTable('delivery_time_slot_availabilities', {
  id: serial('id').primaryKey(),
  deliveryDate: date('delivery_date', { mode: 'string' }).notNull(),
  deliveryTimeSlotId: integer('delivery_time_slot_id').notNull()
    .references(() => deliveryTimeSlots.id, { onDelete: 'cascade' }),
  isAvailable: boolean('is_available').notNull().default(true),
  capacityOrders: integer('capacity_orders'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at'),
}, (table) => [
  uniqueIndex('delivery_slot_availability_date_slot_uidx')
    .on(table.deliveryDate, table.deliveryTimeSlotId),
  index('delivery_slot_availability_date_idx').on(table.deliveryDate),
  check('delivery_slot_availability_capacity_check',
    sql`${table.capacityOrders} IS NULL OR ${table.capacityOrders} >= 0`),
])

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  customerProfileId: integer('customer_profile_id').notNull().references(() => customerProfiles.id, { onDelete: 'restrict' }),
  customerAddressId: integer('customer_address_id').references(() => customerAddresses.id, { onDelete: 'set null' }),
  deliveryFullName: varchar('delivery_full_name', { length: 150 }).notNull(),
  deliveryPhoneNumber: varchar('delivery_phone_number', { length: 30 }).notNull(),
  deliveryCity: varchar('delivery_city', { length: 100 }).notNull(),
  deliveryAddressLine: varchar('delivery_address_line', { length: 1000 }).notNull(),
  status: integer('status').notNull(),
  paymentMethod: integer('payment_method').notNull(),
  deliveryMethod: integer('delivery_method').notNull(),
  subtotalAmount: money('subtotal_amount').notNull(),
  deliveryFee: money('delivery_fee').notNull(),
  totalAmount: money('total_amount').notNull(),
  customerNote: varchar('customer_note', { length: 1000 }),
  adminNote: varchar('admin_note', { length: 1000 }),
  // Delivery-window snapshot. Nullable because orders placed before this feature have no window and
  // must never be given a fabricated one. The title/start/end copies are what order details render,
  // so editing a slot later cannot rewrite what a customer actually chose; the slot id is kept only
  // for operational grouping and is deliberately `set null` on delete.
  deliveryDate: date('delivery_date', { mode: 'string' }),
  deliveryTimeSlotId: integer('delivery_time_slot_id')
    .references(() => deliveryTimeSlots.id, { onDelete: 'set null' }),
  deliveryTimeSlotTitle: varchar('delivery_time_slot_title', { length: 100 }),
  deliveryStartTime: time('delivery_start_time'),
  deliveryEndTime: time('delivery_end_time'),
  createdAt: utcTimestamp('created_at').notNull(),
  confirmedAt: utcTimestamp('confirmed_at'),
  deliveredAt: utcTimestamp('delivered_at'),
  cancelledAt: utcTimestamp('cancelled_at'),
  analyticsVisitorId: uuid('analytics_visitor_id'),
  analyticsSessionId: uuid('analytics_session_id')
    .references(() => analyticsSessions.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('orders_order_number_uidx').on(table.orderNumber),
  index('orders_created_at_idx').on(table.createdAt),
  index('orders_status_created_at_idx').on(table.status, table.createdAt),
  // Serves both slot-capacity counting during checkout and the kitchen's dispatch-order listing.
  index('orders_delivery_date_slot_idx').on(table.deliveryDate, table.deliveryTimeSlotId),
  index('orders_analytics_created_visitor_idx').on(table.createdAt, table.analyticsVisitorId)
    .where(sql`analytics_visitor_id IS NOT NULL`),
  check('orders_status_check', sql`${table.status} BETWEEN 1 AND 6`),
  check('orders_payment_method_check', sql`${table.paymentMethod} BETWEEN 1 AND 4`),
  check('orders_delivery_method_check', sql`${table.deliveryMethod} BETWEEN 1 AND 2`),
  check('orders_money_check', sql`${table.subtotalAmount} >= 0 AND ${table.deliveryFee} >= 0 AND ${table.totalAmount} = ${table.subtotalAmount} + ${table.deliveryFee}`),
])

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  dailyMenuItemId: integer('daily_menu_item_id').notNull().references(() => dailyMenuItems.id, { onDelete: 'restrict' }),
  originalUnitPrice: money('original_unit_price'),
  foodName: varchar('food_name', { length: 150 }).notNull(),
  unitPrice: money('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: money('total_price').notNull(),
}, (table) => [
  index('order_items_order_idx').on(table.orderId),
  check('order_items_quantity_check', sql`${table.quantity} > 0`),
  check('order_items_money_check', sql`${table.unitPrice} >= 0 AND (${table.originalUnitPrice} IS NULL OR ${table.originalUnitPrice} >= ${table.unitPrice}) AND ${table.totalPrice} = ${table.unitPrice} * ${table.quantity}`),
])

export const orderStatusHistories = pgTable('order_status_histories', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: integer('from_status').notNull(),
  toStatus: integer('to_status').notNull(),
  note: varchar('note', { length: 1000 }),
  changedAt: utcTimestamp('changed_at').notNull(),
}, (table) => [
  index('order_status_histories_order_idx').on(table.orderId),
])

export const orderReviews = pgTable('order_reviews', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  customerProfileId: integer('customer_profile_id').notNull()
    .references(() => customerProfiles.id, { onDelete: 'restrict' }),
  rating: integer('rating').notNull(),
  comment: varchar('comment', { length: 1000 }),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at'),
}, (table) => [
  uniqueIndex('order_reviews_order_uidx').on(table.orderId),
  index('order_reviews_customer_created_idx').on(table.customerProfileId, table.createdAt),
  check('order_reviews_rating_check', sql`${table.rating} BETWEEN 1 AND 5`),
])

export const notificationMessages = pgTable('notification_messages', {
  id: serial('id').primaryKey(),
  channel: integer('channel').notNull().default(1),
  type: integer('type').notNull(),
  status: integer('status').notNull().default(1),
  target: varchar('target', { length: 120 }).notNull(),
  text: text('text').notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  orderNumber: varchar('order_number', { length: 32 }),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: utcTimestamp('created_at').notNull(),
  nextAttemptAt: utcTimestamp('next_attempt_at'),
  sentAt: utcTimestamp('sent_at'),
  lastAttemptAt: utcTimestamp('last_attempt_at'),
  lastError: varchar('last_error', { length: 1000 }),
}, (table) => [
  index('notification_messages_pending_idx').on(table.status, table.nextAttemptAt, table.createdAt),
  index('notification_messages_order_idx').on(table.orderId),
  check('notification_messages_channel_check', sql`${table.channel} = 1`),
  check('notification_messages_status_check', sql`${table.status} BETWEEN 1 AND 3`),
  check('notification_messages_retry_check', sql`${table.retryCount} >= 0`),
])

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 150 }).notNull(),
  value: varchar('value', { length: 2000 }).notNull(),
  description: varchar('description', { length: 1000 }),
}, (table) => [
  uniqueIndex('app_settings_key_uidx').on(table.key),
])

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  symbol: varchar('symbol', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [uniqueIndex('units_name_uidx').on(table.name)])

export const ingredientCategories = pgTable('ingredient_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [uniqueIndex('ingredient_categories_name_uidx').on(table.name)])

export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 50 }),
  categoryId: integer('category_id').references(() => ingredientCategories.id, { onDelete: 'set null' }),
  baseUnitId: integer('base_unit_id').notNull().references(() => units.id, { onDelete: 'restrict' }),
  minimumStockLevel: quantity('minimum_stock_level').notNull().default('0'),
  preferredStockLevel: quantity('preferred_stock_level'),
  isInventoryTracked: boolean('is_inventory_tracked').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('ingredients_name_uidx').on(sql`lower(trim(${table.name}))`),
  uniqueIndex('ingredients_code_uidx').on(table.code).where(sql`${table.code} IS NOT NULL`),
  index('ingredients_category_idx').on(table.categoryId),
  check('ingredients_stock_levels_check', sql`${table.minimumStockLevel} >= 0 AND (${table.preferredStockLevel} IS NULL OR ${table.preferredStockLevel} >= 0)`),
])

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  contactName: varchar('contact_name', { length: 150 }),
  mobile: varchar('mobile', { length: 30 }),
  phone: varchar('phone', { length: 30 }),
  address: varchar('address', { length: 1000 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [uniqueIndex('suppliers_name_uidx').on(sql`lower(trim(${table.name}))`)])

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  purchaseNumber: varchar('purchase_number', { length: 50 }).notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'restrict' }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  purchaseDate: date('purchase_date', { mode: 'string' }).notNull(),
  status: integer('status').notNull().default(1),
  subtotalAmount: money('subtotal_amount').notNull(),
  discountAmount: money('discount_amount').notNull().default(0),
  additionalCostAmount: money('additional_cost_amount').notNull().default(0),
  totalAmount: money('total_amount').notNull(),
  paidAmount: money('paid_amount').notNull().default(0),
  paymentStatus: integer('payment_status').notNull().default(1),
  notes: text('notes'),
  attachmentUrl: varchar('attachment_url', { length: 2000 }),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  confirmedByUserId: integer('confirmed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  confirmedAt: utcTimestamp('confirmed_at'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('purchases_number_uidx').on(table.purchaseNumber),
  index('purchases_date_status_idx').on(table.purchaseDate, table.status),
  index('purchases_supplier_idx').on(table.supplierId),
  check('purchases_status_check', sql`${table.status} BETWEEN 1 AND 3`),
  check('purchases_payment_status_check', sql`${table.paymentStatus} BETWEEN 1 AND 3`),
  check('purchases_amounts_check', sql`${table.subtotalAmount} >= 0 AND ${table.discountAmount} >= 0 AND ${table.additionalCostAmount} >= 0 AND ${table.totalAmount} = ${table.subtotalAmount} - ${table.discountAmount} + ${table.additionalCostAmount} AND ${table.paidAmount} >= 0 AND ${table.paidAmount} <= ${table.totalAmount}`),
])

export const purchaseItems = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  purchaseUnitId: integer('purchase_unit_id').notNull().references(() => units.id, { onDelete: 'restrict' }),
  quantity: quantity('quantity').notNull(),
  conversionFactorToBaseUnit: quantity('conversion_factor_to_base_unit').notNull(),
  baseUnitQuantity: quantity('base_unit_quantity').notNull(),
  unitPrice: money('unit_price').notNull(),
  lineDiscountAmount: money('line_discount_amount').notNull().default(0),
  lineTotalAmount: money('line_total_amount').notNull(),
  expirationDate: date('expiration_date', { mode: 'string' }),
  batchNumber: varchar('batch_number', { length: 100 }),
  notes: text('notes'),
}, (table) => [
  index('purchase_items_purchase_idx').on(table.purchaseId),
  index('purchase_items_ingredient_idx').on(table.ingredientId),
  check('purchase_items_quantity_check', sql`${table.quantity} > 0 AND ${table.conversionFactorToBaseUnit} > 0 AND ${table.baseUnitQuantity} > 0`),
  check('purchase_items_amount_check', sql`${table.unitPrice} >= 0 AND ${table.lineDiscountAmount} >= 0 AND ${table.lineTotalAmount} = ROUND(${table.quantity} * ${table.unitPrice} - ${table.lineDiscountAmount}, 2) AND ${table.lineTotalAmount} >= 0`),
])

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  transactionType: integer('transaction_type').notNull(),
  quantityInBaseUnit: quantity('quantity_in_base_unit').notNull(),
  unitCost: money('unit_cost').notNull().default(0),
  totalCost: money('total_cost').notNull().default(0),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: integer('reference_id'),
  transactionGroup: varchar('transaction_group', { length: 80 }),
  transactionDate: utcTimestamp('transaction_date').notNull(),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  reversedTransactionId: integer('reversed_transaction_id'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('inventory_transactions_ingredient_date_idx').on(table.ingredientId, table.transactionDate),
  uniqueIndex('inventory_transactions_reversal_uidx').on(table.reversedTransactionId).where(sql`${table.reversedTransactionId} IS NOT NULL`),
  index('inventory_transactions_reference_idx').on(table.referenceType, table.referenceId),
  check('inventory_transactions_quantity_check', sql`${table.quantityInBaseUnit} <> 0`),
  check('inventory_transactions_type_check', sql`${table.transactionType} BETWEEN 1 AND 8`),
  check('inventory_transactions_sign_check', sql`(
    (${table.transactionType} IN (1, 4, 8) AND ${table.quantityInBaseUnit} > 0) OR
    (${table.transactionType} IN (2, 3, 5, 7) AND ${table.quantityInBaseUnit} < 0) OR
    (${table.transactionType} = 6 AND ${table.quantityInBaseUnit} <> 0)
  ) AND ${table.unitCost} >= 0 AND ${table.quantityInBaseUnit} * ${table.totalCost} >= 0`),
])

export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'restrict' }),
  yieldQuantity: integer('yield_quantity').notNull(),
  preparationLossPercent: numeric('preparation_loss_percent', { precision: 5, scale: 2, mode: 'number' }),
  overheadPerPortion: money('overhead_per_portion').notNull().default(0),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('recipes_active_food_uidx').on(table.foodId).where(sql`${table.isActive} = true`),
  check('recipes_yield_check', sql`${table.yieldQuantity} > 0`),
  check('recipes_values_check', sql`${table.overheadPerPortion} >= 0 AND (${table.preparationLossPercent} IS NULL OR (${table.preparationLossPercent} >= 0 AND ${table.preparationLossPercent} < 100))`),
])

export const recipeItems = pgTable('recipe_items', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  quantityInBaseUnit: quantity('quantity_in_base_unit').notNull(),
  wastePercent: numeric('waste_percent', { precision: 5, scale: 2, mode: 'number' }),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('recipe_items_recipe_ingredient_uidx').on(table.recipeId, table.ingredientId),
  check('recipe_items_quantity_check', sql`${table.quantityInBaseUnit} > 0`),
  check('recipe_items_waste_check', sql`${table.wastePercent} IS NULL OR (${table.wastePercent} >= 0 AND ${table.wastePercent} < 100)`),
])

export const orderInventoryConsumptions = pgTable('order_inventory_consumptions', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  orderItemId: integer('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'restrict' }),
  foodId: integer('food_id').notNull().references(() => foods.id, { onDelete: 'restrict' }),
  recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'restrict' }),
  quantityProduced: integer('quantity_produced').notNull(),
  transactionGroup: varchar('transaction_group', { length: 80 }),
  recipeMissing: boolean('recipe_missing').notNull().default(false),
  consumedAt: utcTimestamp('consumed_at').notNull(),
  reversedAt: utcTimestamp('reversed_at'),
}, (table) => [
  uniqueIndex('order_inventory_consumptions_item_uidx').on(table.orderItemId),
  index('order_inventory_consumptions_order_idx').on(table.orderId),
])

export const shoppingLists = pgTable('shopping_lists', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  targetDate: date('target_date', { mode: 'string' }).notNull(),
  status: integer('status').notNull().default(1),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [check('shopping_lists_status_check', sql`${table.status} BETWEEN 1 AND 4`)])

export const shoppingListItems = pgTable('shopping_list_items', {
  id: serial('id').primaryKey(),
  shoppingListId: integer('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'restrict' }),
  requiredQuantity: quantity('required_quantity').notNull(),
  currentStockSnapshot: quantity('current_stock_snapshot').notNull(),
  suggestedPurchaseQuantity: quantity('suggested_purchase_quantity').notNull(),
  estimatedUnitCost: money('estimated_unit_cost').notNull().default(0),
  notes: text('notes'),
  isPurchased: boolean('is_purchased').notNull().default(false),
}, (table) => [
  uniqueIndex('shopping_list_items_list_ingredient_uidx').on(table.shoppingListId, table.ingredientId),
  check('shopping_list_items_quantities_check', sql`${table.requiredQuantity} > 0 AND ${table.currentStockSnapshot} >= 0 AND ${table.suggestedPurchaseQuantity} >= 0 AND ${table.estimatedUnitCost} >= 0`),
])

export const financialAccounts = pgTable('financial_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  type: integer('type').notNull(),
  bankName: varchar('bank_name', { length: 100 }),
  cardNumberMasked: varchar('card_number_masked', { length: 30 }),
  accountNumberMasked: varchar('account_number_masked', { length: 40 }),
  ibanMasked: varchar('iban_masked', { length: 40 }),
  openingBalance: money('opening_balance').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('financial_accounts_name_uidx').on(table.name),
  check('financial_accounts_type_check', sql`${table.type} BETWEEN 1 AND 5`),
  check('financial_accounts_opening_balance_check', sql`${table.openingBalance} >= 0`),
])

export const posTerminals = pgTable('pos_terminals', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 150 }).notNull(),
  terminalNumber: varchar('terminal_number', { length: 100 }).notNull(),
  merchantNumber: varchar('merchant_number', { length: 100 }),
  financialAccountId: integer('financial_account_id').notNull().references(() => financialAccounts.id, { onDelete: 'restrict' }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [uniqueIndex('pos_terminals_number_uidx').on(table.terminalNumber)])

export const expenseCategories = pgTable('expense_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [uniqueIndex('expense_categories_name_uidx').on(table.name)])

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  paymentMethod: integer('payment_method').notNull(),
  financialAccountId: integer('financial_account_id').notNull().references(() => financialAccounts.id, { onDelete: 'restrict' }),
  posTerminalId: integer('pos_terminal_id').references(() => posTerminals.id, { onDelete: 'restrict' }),
  amount: money('amount').notNull(),
  status: integer('status').notNull().default(1),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  receiptImageUrl: varchar('receipt_image_url', { length: 2000 }),
  paidAt: utcTimestamp('paid_at'),
  confirmedAt: utcTimestamp('confirmed_at'),
  confirmedByUserId: integer('confirmed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  description: text('description'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  index('payments_order_status_idx').on(table.orderId, table.status),
  check('payments_amount_check', sql`${table.amount} > 0`),
  check('payments_method_check', sql`${table.paymentMethod} BETWEEN 1 AND 4`),
  check('payments_status_check', sql`${table.status} BETWEEN 1 AND 7`),
])

export const financialTransactions = pgTable('financial_transactions', {
  id: serial('id').primaryKey(),
  transactionType: integer('transaction_type').notNull(),
  financialAccountId: integer('financial_account_id').notNull().references(() => financialAccounts.id, { onDelete: 'restrict' }),
  amount: money('amount').notNull(),
  transactionDate: utcTimestamp('transaction_date').notNull(),
  categoryId: integer('category_id').references(() => expenseCategories.id, { onDelete: 'restrict' }),
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: integer('reference_id'),
  transactionGroup: varchar('transaction_group', { length: 80 }),
  description: text('description').notNull(),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  reversedTransactionId: integer('reversed_transaction_id'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('financial_transactions_account_date_idx').on(table.financialAccountId, table.transactionDate),
  uniqueIndex('financial_transactions_reference_uidx').on(table.transactionType, table.referenceType, table.referenceId)
    .where(sql`${table.referenceId} IS NOT NULL AND ${table.transactionType} IN (1, 2, 7, 8)`),
  check('financial_transactions_type_check', sql`${table.transactionType} BETWEEN 1 AND 8`),
  check('financial_transactions_amount_check', sql`${table.amount} <> 0`),
  check('financial_transactions_sign_check', sql`
    (${table.transactionType} IN (1, 3, 5) AND ${table.amount} > 0) OR
    (${table.transactionType} IN (2, 4, 6, 7) AND ${table.amount} < 0) OR
    ${table.transactionType} = 8`),
])

export const purchasePayments = pgTable('purchase_payments', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').notNull().references(() => purchases.id, { onDelete: 'restrict' }),
  financialAccountId: integer('financial_account_id').notNull().references(() => financialAccounts.id, { onDelete: 'restrict' }),
  amount: money('amount').notNull(),
  paymentMethod: integer('payment_method').notNull(),
  paidAt: utcTimestamp('paid_at').notNull(),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  index('purchase_payments_purchase_idx').on(table.purchaseId),
  check('purchase_payments_amount_check', sql`${table.amount} > 0`),
  check('purchase_payments_method_check', sql`${table.paymentMethod} BETWEEN 1 AND 4`),
])

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: integer('entity_id'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  details: text('details'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [index('audit_logs_entity_idx').on(table.entityType, table.entityId, table.createdAt)])

export const socialChannels = pgTable('social_channels', {
  id: serial('id').primaryKey(),
  platform: varchar('platform', { length: 30 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  externalChannelId: varchar('external_channel_id', { length: 200 }).notNull(),
  username: varchar('username', { length: 150 }),
  credentialCiphertext: text('credential_ciphertext'),
  isActive: boolean('is_active').notNull().default(true),
  connectionStatus: varchar('connection_status', { length: 20 }).notNull().default('Unknown'),
  lastSuccessfulPublicationAt: utcTimestamp('last_successful_publication_at'),
  lastPublicationError: text('last_publication_error'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('social_channels_platform_external_uidx').on(table.platform, table.externalChannelId),
  index('social_channels_active_platform_idx').on(table.isActive, table.platform),
  check('social_channels_platform_check', sql`${table.platform} IN ('Telegram', 'Bale', 'Eitaa')`),
  check('social_channels_connection_check', sql`${table.connectionStatus} IN ('Unknown', 'Connected', 'Failed')`),
])

export const socialPostTemplates = pgTable('social_post_templates', {
  id: serial('id').primaryKey(),
  templateType: varchar('template_type', { length: 40 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  pattern: text('pattern').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('social_post_templates_type_uidx').on(table.templateType),
  check('social_post_templates_type_check', sql`${table.templateType} IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability', 'Custom')`),
])

export const socialPosts = pgTable('social_posts', {
  id: serial('id').primaryKey(),
  templateType: varchar('template_type', { length: 40 }).notNull(),
  title: varchar('title', { length: 200 }),
  sourceType: varchar('source_type', { length: 50 }),
  sourceId: integer('source_id'),
  defaultText: text('default_text').notNull(),
  mediaUrl: varchar('media_url', { length: 2000 }),
  destinationUrl: varchar('destination_url', { length: 2000 }),
  status: varchar('status', { length: 30 }).notNull().default('Draft'),
  origin: varchar('origin', { length: 20 }).notNull().default('Manual'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
  publishedAt: utcTimestamp('published_at'),
}, (table) => [
  index('social_posts_created_idx').on(table.createdAt),
  index('social_posts_source_idx').on(table.sourceType, table.sourceId, table.createdAt),
  index('social_posts_status_idx').on(table.status, table.createdAt),
  check('social_posts_template_check', sql`${table.templateType} IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability', 'Custom')`),
  check('social_posts_status_check', sql`${table.status} IN ('Draft', 'Publishing', 'Published', 'PartiallyFailed', 'Failed')`),
  check('social_posts_origin_check', sql`${table.origin} IN ('Manual', 'Suggestion', 'Automation')`),
])

export const socialPostTargets = pgTable('social_post_targets', {
  id: serial('id').primaryKey(),
  socialPostId: integer('social_post_id').notNull().references(() => socialPosts.id, { onDelete: 'cascade' }),
  socialChannelId: integer('social_channel_id').notNull().references(() => socialChannels.id, { onDelete: 'restrict' }),
  textOverride: text('text_override'),
  mediaOverride: varchar('media_override', { length: 2000 }),
  destinationUrlOverride: varchar('destination_url_override', { length: 2000 }),
  status: varchar('status', { length: 20 }).notNull().default('Pending'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
  externalMessageId: varchar('external_message_id', { length: 200 }),
  publishedAt: utcTimestamp('published_at'),
  lastError: text('last_error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('social_post_targets_post_channel_uidx').on(table.socialPostId, table.socialChannelId),
  uniqueIndex('social_post_targets_idempotency_uidx').on(table.idempotencyKey),
  index('social_post_targets_status_idx').on(table.status, table.updatedAt),
  check('social_post_targets_status_check', sql`${table.status} IN ('Pending', 'Publishing', 'Published', 'Failed', 'Unknown')`),
  check('social_post_targets_retry_check', sql`${table.retryCount} >= 0 AND ${table.retryCount} <= 5`),
])

export const socialAutomationRules = pgTable('social_automation_rules', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 150 }).notNull(),
  templateType: varchar('template_type', { length: 40 }).notNull(),
  triggerType: varchar('trigger_type', { length: 40 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  executionMode: varchar('execution_mode', { length: 20 }).notNull().default('Suggestion'),
  startTime: time('start_time'),
  endTime: time('end_time'),
  thresholdPercentage: integer('threshold_percentage'),
  cooldownMinutes: integer('cooldown_minutes'),
  maxExecutionsPerDay: integer('max_executions_per_day'),
  maxExecutionsPerFoodPerDay: integer('max_executions_per_food_per_day'),
  priority: integer('priority').notNull().default(100),
  lastEvaluatedAt: utcTimestamp('last_evaluated_at'),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  index('social_rules_enabled_priority_idx').on(table.isEnabled, table.priority),
  check('social_rules_mode_check', sql`${table.executionMode} IN ('Manual', 'Suggestion', 'AutoPublish')`),
  check('social_rules_trigger_check', sql`${table.triggerType} IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability')`),
  check('social_rules_threshold_check', sql`${table.thresholdPercentage} IS NULL OR (${table.thresholdPercentage} BETWEEN 1 AND 99)`),
  check('social_rules_limits_check', sql`(${table.cooldownMinutes} IS NULL OR ${table.cooldownMinutes} >= 0) AND (${table.maxExecutionsPerDay} IS NULL OR ${table.maxExecutionsPerDay} > 0) AND (${table.maxExecutionsPerFoodPerDay} IS NULL OR ${table.maxExecutionsPerFoodPerDay} > 0)`),
])

export const socialAutomationRuleTargets = pgTable('social_automation_rule_targets', {
  ruleId: integer('rule_id').notNull().references(() => socialAutomationRules.id, { onDelete: 'cascade' }),
  socialChannelId: integer('social_channel_id').notNull().references(() => socialChannels.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ name: 'social_automation_rule_targets_pk', columns: [table.ruleId, table.socialChannelId] }),
])

export const socialSuggestions = pgTable('social_suggestions', {
  id: serial('id').primaryKey(),
  ruleId: integer('rule_id').notNull().references(() => socialAutomationRules.id, { onDelete: 'cascade' }),
  templateType: varchar('template_type', { length: 40 }).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: integer('source_id'),
  sourceTitle: varchar('source_title', { length: 200 }),
  logicalDate: date('logical_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('Pending'),
  reason: text('reason').notNull(),
  draftTitle: varchar('draft_title', { length: 200 }).notNull(),
  draftText: text('draft_text').notNull(),
  draftMediaUrl: varchar('draft_media_url', { length: 2000 }),
  draftDestinationUrl: varchar('draft_destination_url', { length: 2000 }),
  dismissedByUserId: integer('dismissed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  dismissedAt: utcTimestamp('dismissed_at'),
  publishedPostId: integer('published_post_id').references(() => socialPosts.id, { onDelete: 'set null' }),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('social_suggestions_logical_uidx')
    .on(table.ruleId, table.sourceType, sql`COALESCE(${table.sourceId}, 0)`, table.logicalDate),
  index('social_suggestions_status_date_idx').on(table.status, table.logicalDate, table.createdAt),
  check('social_suggestions_status_check', sql`${table.status} IN ('Pending', 'Published', 'Dismissed', 'Expired')`),
])

export const socialPublicationAttempts = pgTable('social_publication_attempts', {
  id: serial('id').primaryKey(),
  socialPostTargetId: integer('social_post_target_id').notNull().references(() => socialPostTargets.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  startedAt: utcTimestamp('started_at').notNull(),
  completedAt: utcTimestamp('completed_at'),
  result: varchar('result', { length: 20 }).notNull().default('Started'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
}, (table) => [
  uniqueIndex('social_attempts_target_number_uidx').on(table.socialPostTargetId, table.attemptNumber),
  index('social_attempts_target_started_idx').on(table.socialPostTargetId, table.startedAt),
  check('social_attempts_result_check', sql`${table.result} IN ('Started', 'Succeeded', 'Failed', 'Unknown')`),
])

export const socialSettings = pgTable('social_settings', {
  id: serial('id').primaryKey(),
  singletonKey: boolean('singleton_key').notNull().default(true),
  minimumIntervalMinutes: integer('minimum_interval_minutes').notNull().default(90),
  maximumPostsPerDay: integer('maximum_posts_per_day').notNull().default(5),
  maximumFoodPromotionPerFoodPerDay: integer('maximum_food_promotion_per_food_per_day').notNull().default(1),
  maximumLimitedAvailabilityPerFoodPerDay: integer('maximum_limited_availability_per_food_per_day').notNull().default(1),
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  defaultExecutionMode: varchar('default_execution_mode', { length: 20 }).notNull().default('Suggestion'),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('social_settings_singleton_uidx').on(table.singletonKey),
  check('social_settings_singleton_check', sql`${table.singletonKey}`),
  check('social_settings_values_check', sql`${table.minimumIntervalMinutes} >= 0 AND ${table.maximumPostsPerDay} > 0 AND ${table.maximumFoodPromotionPerFoodPerDay} > 0 AND ${table.maximumLimitedAvailabilityPerFoodPerDay} > 0`),
  check('social_settings_mode_check', sql`${table.defaultExecutionMode} IN ('Manual', 'Suggestion', 'AutoPublish')`),
])

export const socialSettingsDefaultTargets = pgTable('social_settings_default_targets', {
  settingsId: integer('settings_id').notNull().references(() => socialSettings.id, { onDelete: 'cascade' }),
  socialChannelId: integer('social_channel_id').notNull().references(() => socialChannels.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ name: 'social_settings_default_targets_pk', columns: [table.settingsId, table.socialChannelId] }),
])

export type FoodRow = typeof foods.$inferSelect
export type DailyMenuRow = typeof dailyMenus.$inferSelect
export type DailyMenuItemRow = typeof dailyMenuItems.$inferSelect
export type OrderRow = typeof orders.$inferSelect
