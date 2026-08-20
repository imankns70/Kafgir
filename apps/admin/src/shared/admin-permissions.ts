import type { AdminOperation } from './admin-operations'

/**
 * Who may do what.
 *
 * The set shrank with the architecture: there is no inventory, procurement or accounting subsystem
 * left to guard, so the permissions that guarded them are gone rather than left pointing at nothing.
 * What remains splits along one line — running the kitchen, versus seeing and moving money.
 */

const kitchenOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.analytics',
  'foodCategories.list', 'foodCategories.create', 'foodCategories.update',
  'foodTags.list', 'foodTags.create', 'foodTags.update',
  // The kitchen owns catalog reference data: tag groups back the food records it maintains.
  // Checkout configuration is deliberately not included.
  'foodTagGroups.list', 'foodTagGroups.create', 'foodTagGroups.update',
  'supportSubjects.list',
  'foods.list', 'foods.create', 'foods.update', 'foods.setActive',
  'menus.get', 'menus.settings', 'menus.addItem', 'menus.updateItem', 'menus.removeItem',
  'customers.lookup', 'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'support.conversations.list', 'support.conversations.get', 'support.conversations.reply',
  'support.conversations.setClosed', 'support.reviews.list', 'support.reviews.setStatus', 'support.reviews.reply',
  'logs.server',
  // The kitchen does the shopping, so it writes the purchase down and sees the month it lands in.
  'purchases.month', 'purchases.create', 'purchases.update', 'purchases.delete',
  'months.list', 'months.get',
  'deliverySlots.list', 'deliveryDays.get', 'deliveryDays.setOverride',
  // The kitchen sees who is delivering on a given day, but never the courier ledger.
  'couriers.list', 'courierDays.get',
  'social.dashboard', 'social.channels.list', 'social.templates.list',
  'social.draft.generate', 'social.preview', 'social.posts.create',
  'social.suggestions.list', 'social.history',
])

const orderOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.analytics', 'menus.get',
  // Manual order taking needs to know which methods are open to it, but not to change their terms.
  'paymentMethods.list', 'deliveryMethods.list', 'supportSubjects.list',
  'customers.lookup', 'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'support.conversations.list', 'support.conversations.get', 'support.conversations.reply',
  'support.conversations.setClosed', 'support.reviews.list', 'support.reviews.setStatus', 'support.reviews.reply',
  'payments.list', 'payments.totals', 'payments.create', 'payments.changeStatus',
  'logs.server', 'reports.customers', 'customers.search', 'customers.detail',
  'purchases.month', 'months.list', 'months.get',
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
