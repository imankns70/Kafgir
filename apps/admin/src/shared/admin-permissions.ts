import type { AdminOperation } from './admin-operations'

const kitchenOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15',
  'foodCategories.list', 'foodCategories.create', 'foodCategories.update',
  'foodTags.list', 'foodTags.create', 'foodTags.update',
  'foods.list', 'foods.create', 'foods.update', 'foods.setActive',
  'menus.get', 'menus.settings', 'menus.addItem', 'menus.updateItem', 'menus.removeItem',
  'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'units.list', 'ingredients.list', 'ingredients.create', 'ingredients.update',
  'suppliers.list', 'suppliers.create', 'suppliers.update',
  'purchases.list', 'purchases.create', 'purchases.confirm', 'purchases.cancel', 'purchases.pay',
  'inventory.movements', 'inventory.adjust', 'inventory.waste', 'inventory.count',
  'recipes.get', 'recipes.save', 'finance.accounts',
  'shopping.list', 'shopping.requirements', 'shopping.create', 'reports.v15', 'logs.server',
])

const orderOperations = new Set<AdminOperation>([
  'dashboard.today', 'dashboard.v15', 'menus.get',
  'orders.search', 'orders.get', 'orders.create', 'orders.updateStatus',
  'finance.accounts', 'finance.posTerminals',
  'payments.list', 'payments.create', 'payments.changeStatus', 'logs.server',
])

export function isAdminOperationAllowed(operation: AdminOperation, roles: readonly string[]): boolean {
  return roles.includes('Owner') ||
    (roles.includes('KitchenAdmin') && kitchenOperations.has(operation)) ||
    (roles.includes('OrderManager') && orderOperations.has(operation))
}
