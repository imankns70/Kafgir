import type { AdminOperation } from './admin-operations'

const kitchenOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15', 'dashboard.analytics',
  'foodCategories.list', 'foodCategories.create', 'foodCategories.update',
  'foodTags.list', 'foodTags.create', 'foodTags.update',
  // The kitchen owns catalog reference data: tag groups and measurement units back the food and
  // ingredient records it maintains. Checkout configuration is deliberately not included.
  'foodTagGroups.list', 'foodTagGroups.create', 'foodTagGroups.update',
  'units.save', 'supportSubjects.list',
  'foods.list', 'foods.create', 'foods.update', 'foods.setActive',
  'menus.get', 'menus.settings', 'menus.addItem', 'menus.updateItem', 'menus.removeItem',
  'customers.lookup', 'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'support.conversations.list', 'support.conversations.get', 'support.conversations.reply',
  'support.conversations.setClosed', 'support.reviews.list', 'support.reviews.setStatus', 'support.reviews.reply',
  'units.list', 'ingredients.list', 'ingredients.create', 'ingredients.update',
  'suppliers.list', 'suppliers.create', 'suppliers.update',
  'purchases.list', 'purchases.create', 'purchases.confirm', 'purchases.cancel', 'purchases.pay',
  'inventory.movements', 'inventory.adjust', 'inventory.waste', 'inventory.count',
  'recipes.get', 'recipes.save', 'finance.accounts',
  'shopping.list', 'shopping.requirements', 'shopping.create', 'reports.v15', 'logs.server',
  'deliverySlots.list', 'deliveryDays.get', 'deliveryDays.setOverride',
  // The kitchen sees who is delivering on a given day, but never the courier ledger.
  'couriers.list', 'courierDays.get',
  'social.dashboard', 'social.channels.list', 'social.templates.list',
  'social.draft.generate', 'social.preview', 'social.posts.create',
  'social.suggestions.list', 'social.history',
])

const orderOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15', 'dashboard.analytics', 'menus.get',
  // Manual order taking needs to know which methods are open to it, but not to change their terms.
  'paymentMethods.list', 'deliveryMethods.list', 'supportSubjects.list',
  'customers.lookup', 'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'support.conversations.list', 'support.conversations.get', 'support.conversations.reply',
  'support.conversations.setClosed', 'support.reviews.list', 'support.reviews.setStatus', 'support.reviews.reply',
  'finance.accounts', 'finance.posTerminals',
  'payments.list', 'payments.totals', 'payments.create', 'payments.changeStatus', 'logs.server', 'reports.customers', 'customers.search', 'customers.detail',
  'deliverySlots.list', 'deliveryDays.get', 'deliveryDays.setOverride',
  // Order managers run dispatch, so they assign each day's courier and read the resulting work and
  // settlement history. Recording a settlement is money leaving the business, and stays with Owner.
  'couriers.list', 'courierDays.get', 'courierDays.list', 'courierDays.save',
  'courierAccounting.summary', 'courierAccounting.settlements',
])

export function isAdminOperationAllowed(operation: AdminOperation, roles: readonly string[]): boolean {
  return roles.includes('Owner') ||
    (roles.includes('KitchenAdmin') && kitchenOperations.has(operation)) ||
    (roles.includes('OrderManager') && orderOperations.has(operation))
}
