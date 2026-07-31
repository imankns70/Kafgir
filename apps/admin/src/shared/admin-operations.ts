export const adminOperations = [
  'health',
  'dashboard.today',
  'dashboard.v15',
  'foodCategories.list',
  'foodCategories.create',
  'foodCategories.update',
  'foodTags.list',
  'foodTags.create',
  'foodTags.update',
  'foods.list',
  'foods.create',
  'foods.update',
  'foods.setActive',
  'menus.get',
  'menus.settings',
  'menus.addItem',
  'menus.updateItem',
  'menus.removeItem',
  'orders.search',
  'orders.get',
  'orders.create',
  'orders.updateStatus',
  'units.list',
  'ingredients.list',
  'ingredients.create',
  'ingredients.update',
  'suppliers.list',
  'suppliers.create',
  'suppliers.update',
  'purchases.list',
  'purchases.create',
  'purchases.confirm',
  'purchases.cancel',
  'inventory.movements',
  'inventory.adjust',
  'inventory.waste',
  'inventory.count',
  'recipes.get',
  'recipes.save',
  'finance.accounts',
  'finance.createAccount',
  'finance.transactions',
  'finance.createEntry',
  'shopping.requirements',
  'shopping.create',
  'payments.list',
  'payments.changeStatus',
  'payments.refund',
  'reports.v15',
  'logs.server',
] as const

export type AdminOperation = typeof adminOperations[number]

export interface AdminOperationRequest {
  operation: AdminOperation
  payload?: unknown
}

export interface SecureConnectionConfiguration {
  databaseUrl: string
  storage?: {
    endpoint: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    publicBaseUrl: string
  } | null
}

export interface ConnectionConfigurationStatus {
  configured: boolean
  source: 'environment' | 'encrypted' | 'missing'
  storageConfigured: boolean
}
