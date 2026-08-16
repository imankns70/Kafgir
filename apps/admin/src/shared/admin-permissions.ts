import type { AdminOperation } from './admin-operations'

const kitchenOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15', 'dashboard.analytics',
  'foodCategories.list', 'foodCategories.create', 'foodCategories.update',
  'foodTags.list', 'foodTags.create', 'foodTags.update',
  'referenceData.get', 'foodTagGroups.create', 'foodTagGroups.update',
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
  'social.dashboard', 'social.channels.list', 'social.templates.list',
  'social.draft.generate', 'social.preview', 'social.posts.create',
  'social.suggestions.list', 'social.history',
])

const orderOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15', 'dashboard.analytics', 'menus.get', 'referenceData.get',
  'customers.lookup', 'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'support.conversations.list', 'support.conversations.get', 'support.conversations.reply',
  'support.conversations.setClosed', 'support.reviews.list', 'support.reviews.setStatus', 'support.reviews.reply',
  'finance.accounts', 'finance.posTerminals',
  'payments.list', 'payments.create', 'payments.changeStatus', 'logs.server',
  'deliverySlots.list', 'deliveryDays.get', 'deliveryDays.setOverride',
])

export function isAdminOperationAllowed(operation: AdminOperation, roles: readonly string[]): boolean {
  return roles.includes('Owner') ||
    (roles.includes('KitchenAdmin') && kitchenOperations.has(operation)) ||
    (roles.includes('OrderManager') && orderOperations.has(operation))
}
