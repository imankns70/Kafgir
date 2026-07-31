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
  timestamp,
  uniqueIndex,
  varchar,
  bigint,
  check,
  primaryKey,
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
  isActive: boolean('is_active').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
  updatedAt: utcTimestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('foods_slug_uidx').on(table.slug),
  uniqueIndex('foods_name_normalized_uidx').on(sql`lower(btrim(${table.name}))`),
  index('foods_category_id_idx').on(table.categoryId),
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
  capacityPortions: integer('capacity_portions').notNull(),
  soldPortions: integer('sold_portions').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('daily_menu_items_menu_food_uidx').on(table.dailyMenuId, table.foodId),
  check('daily_menu_items_capacity_check', sql`${table.capacityPortions} >= 0`),
  check('daily_menu_items_sold_check', sql`${table.soldPortions} >= 0 AND ${table.soldPortions} <= ${table.capacityPortions}`),
  check('daily_menu_items_price_check', sql`${table.price} >= 0`),
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
  createdAt: utcTimestamp('created_at').notNull(),
  confirmedAt: utcTimestamp('confirmed_at'),
  deliveredAt: utcTimestamp('delivered_at'),
  cancelledAt: utcTimestamp('cancelled_at'),
}, (table) => [
  uniqueIndex('orders_order_number_uidx').on(table.orderNumber),
  index('orders_created_at_idx').on(table.createdAt),
  index('orders_status_created_at_idx').on(table.status, table.createdAt),
  check('orders_status_check', sql`${table.status} BETWEEN 1 AND 6`),
  check('orders_payment_method_check', sql`${table.paymentMethod} BETWEEN 1 AND 4`),
  check('orders_delivery_method_check', sql`${table.deliveryMethod} BETWEEN 1 AND 2`),
  check('orders_money_check', sql`${table.subtotalAmount} >= 0 AND ${table.deliveryFee} >= 0 AND ${table.totalAmount} = ${table.subtotalAmount} + ${table.deliveryFee}`),
])

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  dailyMenuItemId: integer('daily_menu_item_id').notNull().references(() => dailyMenuItems.id, { onDelete: 'restrict' }),
  foodName: varchar('food_name', { length: 150 }).notNull(),
  unitPrice: money('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: money('total_price').notNull(),
}, (table) => [
  index('order_items_order_idx').on(table.orderId),
  check('order_items_quantity_check', sql`${table.quantity} > 0`),
  check('order_items_money_check', sql`${table.unitPrice} >= 0 AND ${table.totalPrice} = ${table.unitPrice} * ${table.quantity}`),
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

export const notificationMessages = pgTable('notification_messages', {
  id: serial('id').primaryKey(),
  channel: integer('channel').notNull().default(1),
  type: integer('type').notNull(),
  status: integer('status').notNull().default(1),
  target: varchar('target', { length: 120 }).notNull(),
  text: varchar('text', { length: 2000 }).notNull(),
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
})

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
}, (table) => [uniqueIndex('shopping_list_items_list_ingredient_uidx').on(table.shoppingListId, table.ingredientId)])

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
}, (table) => [uniqueIndex('financial_accounts_name_uidx').on(table.name)])

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
}, (table) => [index('purchase_payments_purchase_idx').on(table.purchaseId)])

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: integer('entity_id'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  details: text('details'),
  createdAt: utcTimestamp('created_at').notNull(),
}, (table) => [index('audit_logs_entity_idx').on(table.entityType, table.entityId, table.createdAt)])

export type FoodRow = typeof foods.$inferSelect
export type DailyMenuRow = typeof dailyMenus.$inferSelect
export type DailyMenuItemRow = typeof dailyMenuItems.$inferSelect
export type OrderRow = typeof orders.$inferSelect
