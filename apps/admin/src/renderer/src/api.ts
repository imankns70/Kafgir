import type {
  AdminDashboardSummaryDto,
  CustomerAnalyticsTodayDto,
  CustomerProfileDto,
  AdminDeliveryTimeSlotDto,
  AdminDeliveryDayDto,
  DeliveryTimeSlotWriteRequest,
  DeliveryDayOverrideRequest,
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
  CustomerReportDto,
  CustomerDirectoryQuery,
  CustomerDirectoryPageDto,
  CustomerDetailDto,
  PageRequest,
  PagedResult,
  UnitDto,
  UnitWriteRequest,
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
  SocialAutomationEvaluationDto,
  SocialChannelDto,
  SocialChannelWriteRequest,
  SocialDashboardDto,
  SocialDraftDto,
  SocialDraftRequest,
  SocialHistoryPageDto,
  SocialHistoryQuery,
  SocialPostDto,
  SocialPostTargetDto,
  SocialPostWriteRequest,
  SocialPreviewDto,
  SocialPublishResultDto,
  SocialRuleDto,
  SocialRuleWriteRequest,
  SocialSettingsDto,
  SocialSettingsWriteRequest,
  SocialSuggestionDto,
  SocialTemplateDto,
  SocialTemplateWriteRequest,
  AdminOrderReviewDto,
  AdminSupportConversationDto,
  AdminSupportConversationSummaryDto,
  OrderReviewHandlingStatus,
  SupportConversationStatus,
  FoodTagGroupDto,
  FoodTagGroupWriteRequest,
  SupportSubjectDto,
  SupportSubjectWriteRequest,
  PaymentMethod,
  PaymentMethodSettingDto,
  PaymentMethodSettingWriteRequest,
  DeliveryMethod,
  DeliveryMethodSettingDto,
  DeliveryMethodSettingWriteRequest,
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

/** Serialises paging plus a grid's own filters, skipping anything unset. */
const pageQuery = (paging?: PageRequest, extra: Record<string, unknown> = {}) => {
  const params = new URLSearchParams()
  if (paging) { params.set('page', String(paging.page)); params.set('pageSize', String(paging.pageSize)) }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

/** Pulls the shared paging pair out of a query string, omitting absent values. */
const pageParams = (params: URLSearchParams) => ({
  page: params.has('page') ? Number(params.get('page')) : undefined,
  pageSize: params.has('pageSize') ? Number(params.get('pageSize')) : undefined,
})

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
    'GET /api/admin/dashboard/analytics': 'dashboard.analytics',
    'GET /api/admin/food-categories': 'foodCategories.list',
    'POST /api/admin/food-categories': 'foodCategories.create',
    'GET /api/admin/food-tags': 'foodTags.list',
    'POST /api/admin/food-tags': 'foodTags.create',
    'POST /api/admin/foods': 'foods.create',
    'GET /api/admin/units': 'units.list',
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
    'POST /api/admin/shopping-lists': 'shopping.create',
    'GET /api/admin/payments': 'payments.list',
    'POST /api/admin/payments': 'payments.create',
    'GET /api/admin/delivery-slots': 'deliverySlots.list',
    'POST /api/admin/delivery-slots': 'deliverySlots.create',
    'POST /api/admin/delivery-days': 'deliveryDays.setOverride',
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
    // Paginated reads carry their filters and paging in the query string; the generic branch below
    // discards them, which would silently return page 1 forever.
    if (operation === 'purchases.list') {
      return {
        operation,
        payload: {
          status: params.has('status') ? Number(params.get('status')) : undefined,
          ...pageParams(params),
        },
      }
    }
    if (operation === 'payments.list') {
      return { operation, payload: { bucket: params.get('bucket') || undefined, ...pageParams(params) } }
    }
    if (operation === 'finance.transactions') {
      return {
        operation,
        payload: {
          from: params.get('from') || undefined,
          to: params.get('to') || undefined,
          ...pageParams(params),
        },
      }
    }
    return { operation, payload: body === undefined ? undefined : { value: body } }
  }
  if (pathname === '/api/admin/delivery-days' && method === 'GET') {
    return { operation: 'deliveryDays.get', payload: { date: params.get('date') ?? '' } }
  }
  const deliverySlotMatch = /^\/api\/admin\/delivery-slots\/(\d+)(\/active)?$/.exec(pathname ?? '')
  if (deliverySlotMatch) {
    const id = Number(deliverySlotMatch[1])
    if (deliverySlotMatch[2]) {
      return { operation: 'deliverySlots.setActive', payload: { id, isActive: (body as { isActive: boolean }).isActive } }
    }
    return { operation: 'deliverySlots.update', payload: { id, value: body } }
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
          ...pageParams(params),
        },
      },
    }
  }
  if (pathname === '/api/admin/customers/lookup' && method === 'GET') {
    return { operation: 'customers.lookup', payload: { phoneNumber: params.get('phone') ?? '' } }
  }
  if (pathname === '/api/admin/orders' && method === 'POST') {
    return { operation: 'orders.create', payload: { value: body } }
  }
  if (pathname === '/api/admin/ingredients' && method === 'GET') {
    return { operation: 'ingredients.list', payload: { search: params.get('search') ?? '', ...pageParams(params) } }
  }
  if (pathname === '/api/admin/foods' && method === 'GET') {
    return { operation: 'foods.list', payload: { search: params.get('search') ?? '', ...pageParams(params) } }
  }
  if (pathname === '/api/admin/suppliers' && method === 'GET') {
    return { operation: 'suppliers.list', payload: { search: params.get('search') ?? '', ...pageParams(params) } }
  }
  if (pathname === '/api/admin/shopping-lists' && method === 'GET') {
    return { operation: 'shopping.list', payload: { search: params.get('search') ?? '', ...pageParams(params) } }
  }
  if (pathname === '/api/admin/ingredients' && method === 'POST') {
    return { operation: 'ingredients.create', payload: { value: body } }
  }
  if (pathname === '/api/admin/inventory' && method === 'GET') {
    return {
      operation: 'inventory.movements',
      payload: {
        ingredientId: params.has('ingredientId') ? Number(params.get('ingredientId')) : undefined,
        ...pageParams(params),
      },
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

const socialInvoke = async <T>(operation: AdminOperation, payload?: unknown, mutation = false) => {
  try {
    const result = await window.kafgir.invoke<T>(operation, payload)
    if (mutation) notifyMutation('success', 'عملیات با موفقیت انجام شد.')
    return result
  } catch (error) {
    const message = cleanIpcError(error)
    if (mutation) notifyMutation('error', message || 'عملیات انجام نشد.')
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
  customerAnalytics: () => request<CustomerAnalyticsTodayDto>('/api/admin/dashboard/analytics'),
  customerByPhone: (phoneNumber: string) =>
    request<CustomerProfileDto | null>(`/api/admin/customers/lookup?phone=${encodeURIComponent(phoneNumber)}`),
  deliverySlots: () => request<AdminDeliveryTimeSlotDto[]>('/api/admin/delivery-slots'),
  createDeliverySlot: (value: DeliveryTimeSlotWriteRequest) =>
    request<AdminDeliveryTimeSlotDto>('/api/admin/delivery-slots', 'POST', value),
  updateDeliverySlot: (id: number, value: DeliveryTimeSlotWriteRequest) =>
    request<AdminDeliveryTimeSlotDto>(`/api/admin/delivery-slots/${id}`, 'PUT', value),
  setDeliverySlotActive: (id: number, isActive: boolean) =>
    request<void>(`/api/admin/delivery-slots/${id}/active`, 'POST', { isActive }),
  deliveryDay: (date: string) =>
    request<AdminDeliveryDayDto>(`/api/admin/delivery-days?date=${encodeURIComponent(date)}`),
  setDeliveryDayOverride: (value: DeliveryDayOverrideRequest) =>
    request<void>('/api/admin/delivery-days', 'POST', value),
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
  foodTagGroups: () => socialInvoke<FoodTagGroupDto[]>('foodTagGroups.list'),
  supportSubjects: () => socialInvoke<SupportSubjectDto[]>('supportSubjects.list'),
  paymentMethods: () => socialInvoke<PaymentMethodSettingDto[]>('paymentMethods.list'),
  deliveryMethods: () => socialInvoke<DeliveryMethodSettingDto[]>('deliveryMethods.list'),
  createFoodTagGroup: (value: FoodTagGroupWriteRequest) =>
    socialInvoke<FoodTagGroupDto>('foodTagGroups.create', { value }, true),
  updateFoodTagGroup: (code: string, value: FoodTagGroupWriteRequest) =>
    socialInvoke<FoodTagGroupDto>('foodTagGroups.update', { code, value }, true),
  createSupportSubject: (value: SupportSubjectWriteRequest) =>
    socialInvoke<SupportSubjectDto>('supportSubjects.create', { value }, true),
  updateSupportSubject: (id: number, value: SupportSubjectWriteRequest) =>
    socialInvoke<SupportSubjectDto>('supportSubjects.update', { id, value }, true),
  updatePaymentMethod: (method: PaymentMethod, value: PaymentMethodSettingWriteRequest) =>
    socialInvoke<PaymentMethodSettingDto>('paymentMethods.update', { method, value }, true),
  updateDeliveryMethod: (method: DeliveryMethod, value: DeliveryMethodSettingWriteRequest) =>
    socialInvoke<DeliveryMethodSettingDto>('deliveryMethods.update', { method, value }, true),
  foods: () => request<FoodDto[]>('/api/admin/foods'),
  foodsPaged: (paging?: PageRequest, search?: string | null) =>
    request<PagedResult<FoodDto>>(`/api/admin/foods?${pageQuery(paging, { search })}`),
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
    return request<PagedResult<OrderSummaryDto>>(`/api/admin/orders?${params}`)
  },
  order: (id: number) => request<OrderDto>(`/api/admin/orders/${id}`),
  createOrder: (order: CreateOrderRequest) => request<OrderDto>('/api/admin/orders', 'POST', order),
  updateOrderStatus: (id: number, update: UpdateOrderStatusRequest) =>
    request<void>(`/api/admin/orders/${id}/status`, 'PATCH', update),
  units: () => request<UnitDto[]>('/api/admin/units'),
  saveUnit: (id: number | null, value: UnitWriteRequest) =>
    socialInvoke<void>('units.save', { id, value }, true),
  ingredients: (search = '') => request<IngredientDto[]>(`/api/admin/ingredients?search=${encodeURIComponent(search)}`),
  ingredientsPaged: (paging?: PageRequest, search?: string | null) =>
    request<PagedResult<IngredientDto>>(`/api/admin/ingredients?${pageQuery(paging, { search })}`),
  createIngredient: (value: IngredientWriteRequest) => request<void>('/api/admin/ingredients', 'POST', value),
  updateIngredient: (id: number, value: IngredientWriteRequest) => request<void>(`/api/admin/ingredients/${id}`, 'PUT', value),
  suppliers: () => request<SupplierDto[]>('/api/admin/suppliers'),
  suppliersPaged: (paging?: PageRequest, search?: string | null) =>
    request<PagedResult<SupplierDto>>(`/api/admin/suppliers?${pageQuery(paging, { search })}`),
  createSupplier: (value: SupplierWriteRequest) => request<void>('/api/admin/suppliers', 'POST', value),
  updateSupplier: (id: number, value: SupplierWriteRequest) => request<void>(`/api/admin/suppliers/${id}`, 'PUT', value),
  purchases: (status?: number, paging?: PageRequest) =>
    request<PagedResult<PurchaseSummaryDto>>(`/api/admin/purchases?${pageQuery(paging, { status })}`),
  createPurchase: (value: PurchaseWriteRequest) => request<{ id: number }>('/api/admin/purchases', 'POST', value),
  confirmPurchase: (id: number) => request<void>(`/api/admin/purchases/${id}/confirm`, 'POST'),
  cancelPurchase: (id: number) => request<void>(`/api/admin/purchases/${id}/cancel`, 'POST'),
  registerPurchasePayment: (value: PurchasePaymentWriteRequest) =>
    request<void>('/api/admin/purchase-payments', 'POST', value),
  inventoryMovements: (ingredientId?: number, paging?: PageRequest) =>
    request<PagedResult<InventoryMovementDto>>(
      `/api/admin/inventory?${pageQuery(paging, { ingredientId })}`),
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
  financialTransactions: (paging?: PageRequest, range?: { from?: string; to?: string }) => request<PagedResult<{
    id: number; transactionType: number; financialAccountName: string; amount: number;
    transactionDate: string; categoryName: string | null; description: string;
  }>>(`/api/admin/financial-transactions?${pageQuery(paging, range ?? {})}`),
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
  shoppingListsPaged: (paging?: PageRequest, search?: string | null) =>
    request<PagedResult<ShoppingListSummaryDto>>(`/api/admin/shopping-lists?${pageQuery(paging, { search })}`),
  createShoppingList: (value: {
    title: string; targetDate: string; items: Array<{ ingredientId: number; requiredQuantity: string;
      currentStockSnapshot: string; suggestedPurchaseQuantity: string; estimatedUnitCost: number }>
  }) => request<{ id: number }>('/api/admin/shopping-lists', 'POST', value),
  payments: (paging?: PageRequest, bucket?: string) =>
    request<PagedResult<CustomerPaymentDto>>(`/api/admin/payments?${pageQuery(paging, { bucket })}`),
  /** Totals across every payment, so the metric cards do not count only the visible page. */
  paymentTotals: () => socialInvoke<Record<
    'successful' | 'failed' | 'pending' | 'refunded', { count: number; amount: number }
  >>('payments.totals'),
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
  searchCustomers: (query: CustomerDirectoryQuery) =>
    socialInvoke<CustomerDirectoryPageDto>('customers.search', { value: query }),
  customerDetail: (id: number) => socialInvoke<CustomerDetailDto>('customers.detail', { id }),
  customerReport: (from: string, to: string) =>
    socialInvoke<CustomerReportDto>('reports.customers', { value: { from, to } }),
  serverLogs: (limit = 500) => request<LogEntry[]>(`/api/admin/logs?limit=${limit}`),
  desktopLogs: (limit = 500) => window.kafgir.desktopLogs(limit) as Promise<LogEntry[]>,
  supportConversations: (status?: SupportConversationStatus) =>
    socialInvoke<AdminSupportConversationSummaryDto[]>('support.conversations.list', { status }),
  supportConversation: (id: number) =>
    socialInvoke<AdminSupportConversationDto>('support.conversations.get', { id }),
  replySupportConversation: (id: number, message: string) =>
    socialInvoke<AdminSupportConversationDto>('support.conversations.reply', { id, value: { message } }, true),
  setSupportConversationClosed: (id: number, closed: boolean) =>
    socialInvoke<AdminSupportConversationDto>('support.conversations.setClosed', { id, value: { closed } }, true),
  orderReviews: (
    filters: { status?: OrderReviewHandlingStatus | null; rating?: number | null
      from?: string | null; to?: string | null; search?: string | null } = {},
    paging?: PageRequest,
  ) =>
    socialInvoke<PagedResult<AdminOrderReviewDto>>('support.reviews.list', {
      ...filters, page: paging?.page, pageSize: paging?.pageSize,
    }),
  setOrderReviewStatus: (id: number, status: OrderReviewHandlingStatus) =>
    socialInvoke<void>('support.reviews.setStatus', { id, status }, true),
  replyToOrderReview: (id: number, message: string) =>
    socialInvoke<AdminSupportConversationDto>('support.reviews.reply', { id, value: { message } }, true),
  socialDashboard: () => socialInvoke<SocialDashboardDto>('social.dashboard'),
  socialChannels: () => socialInvoke<SocialChannelDto[]>('social.channels.list'),
  saveSocialChannel: (id: number | null, value: SocialChannelWriteRequest) =>
    socialInvoke<SocialChannelDto>('social.channels.save', { id, value }, true),
  testSocialChannel: (id: number) => socialInvoke<{
    supported: boolean; connected: boolean; detail: string
  }>('social.channels.test', { id }, true),
  socialTemplates: () => socialInvoke<SocialTemplateDto[]>('social.templates.list'),
  saveSocialTemplate: (value: SocialTemplateWriteRequest) =>
    socialInvoke<SocialTemplateDto>('social.templates.save', { value }, true),
  generateSocialDraft: (value: SocialDraftRequest) =>
    socialInvoke<SocialDraftDto>('social.draft.generate', { value }),
  previewSocialPost: (value: SocialPostWriteRequest) =>
    socialInvoke<SocialPreviewDto[]>('social.preview', { value }),
  createSocialPost: (value: SocialPostWriteRequest) =>
    socialInvoke<SocialPostDto>('social.posts.create', { value }, true),
  publishSocialPost: (id: number) =>
    socialInvoke<SocialPublishResultDto>('social.posts.publish', { id }, true),
  socialSuggestions: (date?: string) =>
    socialInvoke<SocialSuggestionDto[]>('social.suggestions.list', { date }),
  dismissSocialSuggestion: (id: number) =>
    socialInvoke<void>('social.suggestions.dismiss', { id }, true),
  evaluateSocialAutomation: () =>
    socialInvoke<SocialAutomationEvaluationDto>('social.automation.evaluate', undefined, true),
  socialRules: () => socialInvoke<SocialRuleDto[]>('social.rules.list'),
  saveSocialRule: (id: number | null, value: SocialRuleWriteRequest) =>
    socialInvoke<SocialRuleDto>('social.rules.save', { id, value }, true),
  socialSettings: () => socialInvoke<SocialSettingsDto>('social.settings.get'),
  saveSocialSettings: (value: SocialSettingsWriteRequest) =>
    socialInvoke<SocialSettingsDto>('social.settings.save', { value }, true),
  socialHistory: (query: SocialHistoryQuery) =>
    socialInvoke<SocialHistoryPageDto>('social.history', { query }),
  retrySocialTarget: (id: number) =>
    socialInvoke<SocialPostTargetDto>('social.targets.retry', { id }, true),
}
