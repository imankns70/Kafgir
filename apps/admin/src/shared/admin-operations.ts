export const adminOperations = [
  'health',
  'dashboard.today',
  'dashboard.analytics',
  'deliverySlots.list',
  'deliverySlots.create',
  'deliverySlots.update',
  'deliverySlots.setActive',
  'deliveryDays.get',
  'deliveryDays.setOverride',
  // Couriers are three separate concerns, listed separately so a role can be given the dispatch view
  // without being given the money: the directory, the per-day arrangement, and the accounting ledger.
  'couriers.list',
  'couriers.create',
  'couriers.update',
  'couriers.setActive',
  'courierDays.get',
  'courierDays.list',
  'courierDays.save',
  'courierAccounting.summary',
  'courierAccounting.settlements',
  'courierAccounting.settle',
  // Purchases and the monthly picture. What used to be a procurement and accounting subsystem is now
  // four operations: write a purchase down, read a month's purchases, read a month, list months.
  'purchases.month',
  'purchases.create',
  'purchases.update',
  'purchases.delete',
  'months.list',
  'months.get',
  'foodCategories.list',
  'foodCategories.create',
  'foodCategories.update',
  'foodTags.list',
  'foodTags.create',
  'foodTags.update',
  // Reference data and checkout configuration are listed per entity rather than through one
  // aggregate read. The aggregate forced every screen that needed a single list — the tag editor,
  // the manual-order form — to be granted the whole set, including payment terms.
  'foodTagGroups.list',
  'foodTagGroups.create',
  'foodTagGroups.update',
  'supportSubjects.list',
  'supportSubjects.create',
  'supportSubjects.update',
  'paymentMethods.list',
  'paymentMethods.update',
  'deliveryMethods.list',
  'deliveryMethods.update',
  'foods.list',
  'foods.create',
  'foods.update',
  'foods.setActive',
  'menus.get',
  'menus.settings',
  'menus.addItem',
  'menus.updateItem',
  'menus.removeItem',
  'customers.lookup',
  'orders.search',
  'orders.get',
  'orders.create',
  'orders.updateStatus',
  'support.conversations.list',
  'support.conversations.get',
  'support.conversations.reply',
  'support.conversations.setClosed',
  'support.reviews.list',
  'support.reviews.setStatus',
  'support.reviews.reply',
  'payments.list',
  'payments.totals',
  'payments.create',
  'payments.changeStatus',
  'payments.refund',
  'reports.customers',
  'customers.search',
  'customers.detail',
  'logs.server',
  'social.dashboard',
  'social.channels.list',
  'social.channels.save',
  'social.channels.test',
  'social.templates.list',
  'social.templates.save',
  'social.draft.generate',
  'social.preview',
  'social.posts.create',
  'social.posts.publish',
  'social.suggestions.list',
  'social.suggestions.dismiss',
  'social.automation.evaluate',
  'social.rules.list',
  'social.rules.save',
  'social.settings.get',
  'social.settings.save',
  'social.history',
  'social.targets.retry',
] as const

export type AdminOperation = typeof adminOperations[number]

export interface AdminOperationRequest {
  operation: AdminOperation
  payload?: unknown
}

export interface SecureConnectionConfiguration {
  databaseUrl: string
  cloudinary?: {
    cloudName: string
    apiKey: string
    apiSecret: string
  } | null
}

export interface ConnectionConfigurationStatus {
  configured: boolean
  source: 'environment' | 'encrypted' | 'missing'
  storageConfigured: boolean
}
