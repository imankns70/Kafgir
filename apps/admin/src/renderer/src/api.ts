import type {
  AdminDashboardSummaryDto,
  CreateOrderRequest,
  DailyMenuDto,
  DailyMenuItemWriteRequest,
  FoodCategoryDto,
  FoodCategoryWriteRequest,
  FoodDto,
  FoodTagDto,
  FoodTagWriteRequest,
  FoodWriteRequest,
  OrderDto,
  OrderReportQuery,
  OrderSummaryDto,
  UpdateDailyMenuItemRequest,
  UpdateOrderStatusRequest,
  FinancialAccountWriteRequest,
  AccountTransferRequest,
  IngredientWriteRequest,
  InventoryAdjustmentRequest,
  PurchaseWriteRequest,
  PurchasePaymentWriteRequest,
  PaymentWriteRequest,
  PosTerminalWriteRequest,
  RecipeWriteRequest,
  StockCountRequest,
  SupplierWriteRequest,
  WasteWriteRequest,
  UnitDto,
  IngredientDto,
  SupplierDto,
  FinancialAccountDto,
  ExpenseCategoryDto,
  InventoryMovementDto,
  PurchaseSummaryDto,
  PosTerminalDto,
  RecipeDto,
  ShoppingListSummaryDto,
  CustomerPaymentDto,
} from '@kafgir/contracts'
import type { AdminOperation } from '../../shared/admin-operations'

const cleanIpcError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/^Error invoking remote method '[^']+': Error:\s*/u, '')
    .replace(/^Error:\s*/u, '')
}

type ToastKind = 'success' | 'error'

const notifyMutation = (kind: ToastKind, message: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('kafgir:toast', {
    detail: { kind, message },
  }))
}

const isMutation = (method: string) => method.toUpperCase() !== 'GET'

const directOperation = (
  path: string,
  method: string,
  body: unknown,
): { operation: AdminOperation; payload?: unknown } => {
  const [pathname, queryString = ''] = path.split('?')
  const params = new URLSearchParams(queryString)
  const exact: Record<string, AdminOperation> = {
    'GET /api/health': 'health',
    'GET /api/admin/dashboard/today': 'dashboard.today',
    'GET /api/admin/dashboard/v15': 'dashboard.v15',
    'GET /api/admin/food-categories': 'foodCategories.list',
    'POST /api/admin/food-categories': 'foodCategories.create',
    'GET /api/admin/food-tags': 'foodTags.list',
    'POST /api/admin/food-tags': 'foodTags.create',
    'GET /api/admin/foods': 'foods.list',
    'POST /api/admin/foods': 'foods.create',
    'GET /api/admin/units': 'units.list',
    'GET /api/admin/suppliers': 'suppliers.list',
    'POST /api/admin/suppliers': 'suppliers.create',
    'GET /api/admin/purchases': 'purchases.list',
    'POST /api/admin/purchases': 'purchases.create',
    'POST /api/admin/purchase-payments': 'purchases.pay',
    'GET /api/admin/financial-accounts': 'finance.accounts',
    'GET /api/admin/expense-categories': 'finance.expenseCategories',
    'POST /api/admin/financial-accounts': 'finance.createAccount',
    'GET /api/admin/financial-transactions': 'finance.transactions',
    'POST /api/admin/financial-transactions': 'finance.createEntry',
    'POST /api/admin/financial-transactions/transfers': 'finance.transfer',
    'GET /api/admin/pos-terminals': 'finance.posTerminals',
    'POST /api/admin/pos-terminals': 'finance.createPosTerminal',
    'GET /api/admin/shopping-lists': 'shopping.list',
    'POST /api/admin/shopping-lists': 'shopping.create',
    'GET /api/admin/payments': 'payments.list',
    'POST /api/admin/payments': 'payments.create',
    'GET /api/admin/logs': 'logs.server',
  }
  const key = `${method.toUpperCase()} ${pathname}`
  const operation = exact[key]
  if (operation) {
    if (operation === 'orders.search') return { operation, payload: { query: body } }
    if (operation === 'logs.server') {
      return { operation, payload: { limit: Number(params.get('limit') ?? 500) } }
    }
    if (operation === 'finance.createEntry') {
      const value = body as { kind: string; entry: unknown }
      return { operation, payload: { kind: value.kind, value: value.entry } }
    }
    return { operation, payload: body === undefined ? undefined : { value: body } }
  }
  if (pathname === '/api/admin/orders' && method === 'GET') {
    const numeric = (name: string) => params.has(name) ? Number(params.get(name)) : undefined
    return {
      operation: 'orders.search',
      payload: {
        query: {
          date: params.get('date') || undefined,
          status: numeric('status'),
          orderNumber: params.get('orderNumber') || undefined,
          customerName: params.get('customerName') || undefined,
          phoneNumber: params.get('phoneNumber') || undefined,
          deliveryMethod: numeric('deliveryMethod'),
          paymentMethod: numeric('paymentMethod'),
          foodName: params.get('foodName') || undefined,
        },
      },
    }
  }
  if (pathname === '/api/admin/orders' && method === 'POST') {
    return { operation: 'orders.create', payload: { value: body } }
  }
  if (pathname === '/api/admin/ingredients' && method === 'GET') {
    return { operation: 'ingredients.list', payload: { search: params.get('search') ?? '' } }
  }
  if (pathname === '/api/admin/ingredients' && method === 'POST') {
    return { operation: 'ingredients.create', payload: { value: body } }
  }
  if (pathname === '/api/admin/inventory' && method === 'GET') {
    return {
      operation: 'inventory.movements',
      payload: { ingredientId: params.has('ingredientId') ? Number(params.get('ingredientId')) : undefined },
    }
  }
  if (pathname === '/api/admin/inventory/adjustments' && method === 'POST') {
    return { operation: 'inventory.adjust', payload: { value: body } }
  }
  if (pathname === '/api/admin/waste' && method === 'POST') {
    return { operation: 'inventory.waste', payload: { value: body } }
  }
  if (pathname === '/api/admin/inventory/counts' && method === 'POST') {
    return { operation: 'inventory.count', payload: { value: body } }
  }
  if (pathname === '/api/admin/shopping-lists/requirements' && method === 'GET') {
    return {
      operation: 'shopping.requirements',
      payload: { from: params.get('from'), to: params.get('to') },
    }
  }
  if (pathname === '/api/admin/reports/v15' && method === 'GET') {
    return { operation: 'reports.v15', payload: { from: params.get('from'), to: params.get('to') } }
  }
  const patterns: Array<{
    regex: RegExp
    operation: AdminOperation
    payload: (match: RegExpMatchArray) => unknown
  }> = [
    { regex: /^\/api\/admin\/food-categories\/(\d+)$/u, operation: 'foodCategories.update',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/food-tags\/(\d+)$/u, operation: 'foodTags.update',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/foods\/(\d+)$/u, operation: 'foods.update',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/foods\/(\d+)\/active$/u, operation: 'foods.setActive',
      payload: (match) => ({ id: Number(match[1]), ...(body as object) }) },
    { regex: /^\/api\/admin\/daily-menus\/by-date\/([^/]+)$/u,
      operation: method === 'GET' ? 'menus.get' : 'menus.settings',
      payload: (match) => method === 'GET'
        ? { date: decodeURIComponent(match[1]!) }
        : { date: decodeURIComponent(match[1]!), value: body } },
    { regex: /^\/api\/admin\/daily-menus\/by-date\/([^/]+)\/items$/u, operation: 'menus.addItem',
      payload: (match) => ({ date: decodeURIComponent(match[1]!), value: body }) },
    { regex: /^\/api\/admin\/daily-menus\/items\/(\d+)$/u,
      operation: method === 'DELETE' ? 'menus.removeItem' : 'menus.updateItem',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/orders\/(\d+)$/u, operation: 'orders.get',
      payload: (match) => ({ id: Number(match[1]) }) },
    { regex: /^\/api\/admin\/orders\/(\d+)\/status$/u, operation: 'orders.updateStatus',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/ingredients\/(\d+)$/u, operation: 'ingredients.update',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/suppliers\/(\d+)$/u, operation: 'suppliers.update',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/purchases\/(\d+)\/confirm$/u, operation: 'purchases.confirm',
      payload: (match) => ({ id: Number(match[1]) }) },
    { regex: /^\/api\/admin\/purchases\/(\d+)\/cancel$/u, operation: 'purchases.cancel',
      payload: (match) => ({ id: Number(match[1]) }) },
    { regex: /^\/api\/admin\/financial-accounts\/(\d+)$/u, operation: 'finance.updateAccount',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/pos-terminals\/(\d+)$/u, operation: 'finance.updatePosTerminal',
      payload: (match) => ({ id: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/recipes\/(\d+)$/u,
      operation: method === 'GET' ? 'recipes.get' : 'recipes.save',
      payload: (match) => ({ foodId: Number(match[1]), value: body }) },
    { regex: /^\/api\/admin\/payments\/(\d+)\/status$/u, operation: 'payments.changeStatus',
      payload: (match) => ({ id: Number(match[1]), ...(body as object) }) },
    { regex: /^\/api\/admin\/payments\/(\d+)\/refund$/u, operation: 'payments.refund',
      payload: (match) => ({ id: Number(match[1]) }) },
  ]
  for (const candidate of patterns) {
    const match = pathname!.match(candidate.regex)
    if (match) return { operation: candidate.operation, payload: candidate.payload(match) }
  }
  throw new Error(`Unsupported admin operation: ${method} ${pathname}`)
}

const request = async <T>(path: string, method = 'GET', body?: unknown) => {
  try {
    if (path === '/api/admin/foods/images' && method === 'DELETE') {
      await window.kafgir.deleteFoodImage((body as { imageUrl: string }).imageUrl)
      if (isMutation(method)) notifyMutation('success', 'عملیات با موفقیت انجام شد.')
      return undefined as T
    }
    const direct = directOperation(path, method, body)
    const response = await window.kafgir.invoke<T>(direct.operation, direct.payload)
    if (isMutation(method)) notifyMutation('success', 'عملیات با موفقیت انجام شد.')
    return response
  } catch (error) {
    const message = cleanIpcError(error)
    if (isMutation(method)) notifyMutation('error', message || 'عملیات انجام نشد.')
    throw new Error(message)
  }
}

export interface LogEntry {
  time?: number
  level?: number
  service?: string
  event?: string
  msg?: string
  errorMessage?: string
  requestId?: string
  userId?: number
  orderId?: number
  purchaseId?: number
  [key: string]: unknown
}

export const adminApi = {
  configurationStatus: () => window.kafgir.configurationStatus(),
  saveConfiguration: (value: Parameters<typeof window.kafgir.saveConfiguration>[0]) =>
    window.kafgir.saveConfiguration(value),
  clearConfiguration: () => window.kafgir.clearConfiguration(),
  health: () => request<{ status: string }>('/api/health'),
  login: (username: string, password: string) =>
    window.kafgir.login({ username, password }),
  logout: () => window.kafgir.logout(),
  dashboard: () => request<AdminDashboardSummaryDto>('/api/admin/dashboard/today'),
  foodCategories: () => request<FoodCategoryDto[]>('/api/admin/food-categories'),
  createFoodCategory: (category: FoodCategoryWriteRequest) =>
    request<FoodCategoryDto>('/api/admin/food-categories', 'POST', category),
  updateFoodCategory: (id: number, category: FoodCategoryWriteRequest) =>
    request<FoodCategoryDto>(`/api/admin/food-categories/${id}`, 'PUT', category),
  foodTags: () => request<FoodTagDto[]>('/api/admin/food-tags'),
  createFoodTag: (tag: FoodTagWriteRequest) =>
    request<FoodTagDto>('/api/admin/food-tags', 'POST', tag),
  updateFoodTag: (id: number, tag: FoodTagWriteRequest) =>
    request<FoodTagDto>(`/api/admin/food-tags/${id}`, 'PUT', tag),
  foods: () => request<FoodDto[]>('/api/admin/foods'),
  createFood: (food: FoodWriteRequest) => request<FoodDto>('/api/admin/foods', 'POST', food),
  updateFood: (id: number, food: FoodWriteRequest) => request<void>(`/api/admin/foods/${id}`, 'PUT', food),
  uploadFoodImage: (file: File) => file.arrayBuffer().then((bytes) =>
    window.kafgir.uploadFoodImage({ name: file.name, type: file.type, bytes })),
  deleteFoodImage: (imageUrl: string) =>
    request<void>('/api/admin/foods/images', 'DELETE', { imageUrl }),
  resolveMediaUrl: (imageUrl: string) => window.kafgir.resolveMediaUrl(imageUrl),
  setFoodActive: (id: number, isActive: boolean) =>
    request<void>(`/api/admin/foods/${id}/active`, 'PATCH', { isActive }),
  menu: (date: string) => request<DailyMenuDto>(`/api/admin/daily-menus/by-date/${date}`),
  menuSettings: (date: string, isOpen: boolean, note?: string | null) =>
    request<DailyMenuDto>(`/api/admin/daily-menus/by-date/${date}`, 'PATCH', { isOpen, note }),
  addMenuItem: (date: string, item: DailyMenuItemWriteRequest) =>
    request<DailyMenuDto>(`/api/admin/daily-menus/by-date/${date}/items`, 'POST', item),
  updateMenuItem: (id: number, item: UpdateDailyMenuItemRequest) =>
    request<DailyMenuDto>(`/api/admin/daily-menus/items/${id}`, 'PATCH', item),
  removeMenuItem: (id: number) => request<DailyMenuDto>(`/api/admin/daily-menus/items/${id}`, 'DELETE'),
  orders: (query: OrderReportQuery) => {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    })
    return request<OrderSummaryDto[]>(`/api/admin/orders?${params}`)
  },
  order: (id: number) => request<OrderDto>(`/api/admin/orders/${id}`),
  createOrder: (order: CreateOrderRequest) => request<OrderDto>('/api/admin/orders', 'POST', order),
  updateOrderStatus: (id: number, update: UpdateOrderStatusRequest) =>
    request<void>(`/api/admin/orders/${id}/status`, 'PATCH', update),
  units: () => request<UnitDto[]>('/api/admin/units'),
  ingredients: (search = '') => request<IngredientDto[]>(`/api/admin/ingredients?search=${encodeURIComponent(search)}`),
  createIngredient: (value: IngredientWriteRequest) => request<void>('/api/admin/ingredients', 'POST', value),
  updateIngredient: (id: number, value: IngredientWriteRequest) => request<void>(`/api/admin/ingredients/${id}`, 'PUT', value),
  suppliers: () => request<SupplierDto[]>('/api/admin/suppliers'),
  createSupplier: (value: SupplierWriteRequest) => request<void>('/api/admin/suppliers', 'POST', value),
  updateSupplier: (id: number, value: SupplierWriteRequest) => request<void>(`/api/admin/suppliers/${id}`, 'PUT', value),
  purchases: () => request<PurchaseSummaryDto[]>('/api/admin/purchases'),
  createPurchase: (value: PurchaseWriteRequest) => request<{ id: number }>('/api/admin/purchases', 'POST', value),
  confirmPurchase: (id: number) => request<void>(`/api/admin/purchases/${id}/confirm`, 'POST'),
  cancelPurchase: (id: number) => request<void>(`/api/admin/purchases/${id}/cancel`, 'POST'),
  registerPurchasePayment: (value: PurchasePaymentWriteRequest) =>
    request<void>('/api/admin/purchase-payments', 'POST', value),
  inventoryMovements: (ingredientId?: number) => request<InventoryMovementDto[]>(
    `/api/admin/inventory${ingredientId ? `?ingredientId=${ingredientId}` : ''}`),
  adjustInventory: (value: InventoryAdjustmentRequest) =>
    request<void>('/api/admin/inventory/adjustments', 'POST', value),
  registerWaste: (value: WasteWriteRequest) => request<void>('/api/admin/waste', 'POST', value),
  confirmStockCount: (value: StockCountRequest) => request<void>('/api/admin/inventory/counts', 'POST', value),
  recipe: (foodId: number) => request<RecipeDto | null>(`/api/admin/recipes/${foodId}`),
  saveRecipe: (foodId: number, value: RecipeWriteRequest) => request<void>(`/api/admin/recipes/${foodId}`, 'PUT', value),
  financialAccounts: () => request<FinancialAccountDto[]>('/api/admin/financial-accounts'),
  expenseCategories: () => request<ExpenseCategoryDto[]>('/api/admin/expense-categories'),
  createFinancialAccount: (value: FinancialAccountWriteRequest) =>
    request<void>('/api/admin/financial-accounts', 'POST', value),
  updateFinancialAccount: (id: number, value: FinancialAccountWriteRequest) =>
    request<void>(`/api/admin/financial-accounts/${id}`, 'PUT', value),
  financialTransactions: () => request<Array<{
    id: number; transactionType: number; financialAccountName: string; amount: number;
    transactionDate: string; categoryName: string | null; description: string;
  }>>('/api/admin/financial-transactions'),
  createFinancialEntry: (kind: 'income' | 'expense', entry: {
    financialAccountId: number; amount: number; categoryId?: number | null; description: string
  }) => request<void>('/api/admin/financial-transactions', 'POST', { kind, entry }),
  transferFinancialAmount: (value: AccountTransferRequest) =>
    request<void>('/api/admin/financial-transactions/transfers', 'POST', value),
  posTerminals: () => request<PosTerminalDto[]>('/api/admin/pos-terminals'),
  createPosTerminal: (value: PosTerminalWriteRequest) =>
    request<void>('/api/admin/pos-terminals', 'POST', value),
  updatePosTerminal: (id: number, value: PosTerminalWriteRequest) =>
    request<void>(`/api/admin/pos-terminals/${id}`, 'PUT', value),
  v15Dashboard: () => request<{
    todaySales: number; unverifiedPayments: number; todayExpense: number; lowStockCount: number;
    unpaidPurchases: number; missingRecipeOrders: number; todayWasteCost: number;
  }>('/api/admin/dashboard/v15'),
  shoppingRequirements: (from: string, to: string) => request<Array<{
    ingredientId: number; ingredientName: string; unitName: string; requiredQuantity: string;
    currentStock: string; shortageQuantity: string; estimatedUnitCost: number; estimatedPurchaseCost: number;
  }>>(`/api/admin/shopping-lists/requirements?from=${from}&to=${to}`),
  shoppingLists: () => request<ShoppingListSummaryDto[]>('/api/admin/shopping-lists'),
  createShoppingList: (value: {
    title: string; targetDate: string; items: Array<{ ingredientId: number; requiredQuantity: string;
      currentStockSnapshot: string; suggestedPurchaseQuantity: string; estimatedUnitCost: number }>
  }) => request<{ id: number }>('/api/admin/shopping-lists', 'POST', value),
  payments: () => request<CustomerPaymentDto[]>('/api/admin/payments'),
  createPayment: (value: PaymentWriteRequest) => request<{ id: number }>('/api/admin/payments', 'POST', value),
  changePaymentStatus: (id: number, status: number) =>
    request<void>(`/api/admin/payments/${id}/status`, 'PATCH', { status }),
  refundPayment: (id: number) => request<void>(`/api/admin/payments/${id}/refund`, 'POST'),
  v15Reports: (from: string, to: string) => request<{
    sales: Array<{ paymentMethod: number; count: number; paidAmount: number; refundedAmount: number }>;
    expenses: Array<{ category: string; amount: number }>;
    profit: { income: number; expense: number };
    usage: Array<{ name: string; unit: string; purchase: string | null; consumption: string | null; waste: string | null; closing: string }>;
    waste: Array<{ name: string; quantity: string; cost: number }>;
  }>(`/api/admin/reports/v15?from=${from}&to=${to}`),
  serverLogs: (limit = 500) => request<LogEntry[]>(`/api/admin/logs?limit=${limit}`),
  desktopLogs: (limit = 500) => window.kafgir.desktopLogs(limit) as Promise<LogEntry[]>,
}
