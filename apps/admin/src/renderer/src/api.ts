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
  PurchaseWriteRequest,
  PurchaseDto,
  MonthPurchasesDto,
  MonthListItemDto,
  MonthlyReportDto,
  PaymentWriteRequest,
  CustomerReportDto,
  CustomerDirectoryQuery,
  CustomerDirectoryPageDto,
  CustomerDetailDto,
  PageRequest,
  PagedResult,
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
  AdminOrderDetailDto,
  CourierDto,
  CourierWriteRequest,
  CourierDeliveryDayDto,
  CourierDeliveryDayViewDto,
  CourierDeliveryDayWriteRequest,
  CourierAccountSummaryDto,
  CourierSettlementDto,
  CourierSettlementWriteRequest,
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
    'GET /api/admin/dashboard/analytics': 'dashboard.analytics',
    'GET /api/admin/food-categories': 'foodCategories.list',
    'POST /api/admin/food-categories': 'foodCategories.create',
    'GET /api/admin/food-tags': 'foodTags.list',
    'POST /api/admin/food-tags': 'foodTags.create',
    'POST /api/admin/foods': 'foods.create',
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
    // Paginated reads carry their filters and paging in the query string; the generic branch below
    // discards them, which would silently return page 1 forever.
    if (operation === 'payments.list') {
      return { operation, payload: { bucket: params.get('bucket') || undefined, ...pageParams(params) } }
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
  if (pathname === '/api/admin/foods' && method === 'GET') {
    return { operation: 'foods.list', payload: { search: params.get('search') ?? '', ...pageParams(params) } }
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
  couriers: () => socialInvoke<CourierDto[]>('couriers.list'),
  createCourier: (value: CourierWriteRequest) =>
    socialInvoke<CourierDto>('couriers.create', { value }, true),
  updateCourier: (id: number, value: CourierWriteRequest) =>
    socialInvoke<CourierDto>('couriers.update', { id, value }, true),
  setCourierActive: (id: number, isActive: boolean) =>
    socialInvoke<void>('couriers.setActive', { id, isActive }, true),
  courierDay: (date: string) =>
    socialInvoke<CourierDeliveryDayViewDto>('courierDays.get', { date }),
  courierDays: () => socialInvoke<CourierDeliveryDayDto[]>('courierDays.list'),
  saveCourierDay: (value: CourierDeliveryDayWriteRequest) =>
    socialInvoke<CourierDeliveryDayViewDto>('courierDays.save', { value }, true),
  courierAccounts: () => socialInvoke<CourierAccountSummaryDto[]>('courierAccounting.summary'),
  courierSettlements: (courierId: number) =>
    socialInvoke<CourierSettlementDto[]>('courierAccounting.settlements', { courierId }),
  settleCourier: (value: CourierSettlementWriteRequest) =>
    socialInvoke<CourierAccountSummaryDto>('courierAccounting.settle', { value }, true),
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
  order: (id: number) => request<AdminOrderDetailDto>(`/api/admin/orders/${id}`),
  createOrder: (order: CreateOrderRequest) => request<OrderDto>('/api/admin/orders', 'POST', order),
  updateOrderStatus: (id: number, update: UpdateOrderStatusRequest) =>
    request<void>(`/api/admin/orders/${id}/status`, 'PATCH', update),
  // Purchases and the monthly picture. All four go straight over IPC — they have no HTTP route,
  // because only the desktop app records what the kitchen spent.
  monthPurchases: (year: number, month: number) =>
    socialInvoke<MonthPurchasesDto>('purchases.month', { year, month }),
  createPurchase: (value: PurchaseWriteRequest) =>
    socialInvoke<PurchaseDto>('purchases.create', { value }, true),
  updatePurchase: (id: number, value: PurchaseWriteRequest) =>
    socialInvoke<PurchaseDto>('purchases.update', { id, value }, true),
  deletePurchase: (id: number) => socialInvoke<void>('purchases.delete', { id }, true),
  months: () => socialInvoke<MonthListItemDto[]>('months.list'),
  month: (year: number, month: number) =>
    socialInvoke<MonthlyReportDto>('months.get', { year, month }),
  payments: (paging?: PageRequest, bucket?: string) =>
    request<PagedResult<CustomerPaymentDto>>(`/api/admin/payments?${pageQuery(paging, { bucket })}`),
  /** Totals across every payment, so the metric cards do not count only the visible page. */
  paymentTotals: () => socialInvoke<Record<
    'all' | 'successful' | 'failed' | 'pending' | 'refunded', { count: number; amount: number }
  >>('payments.totals'),
  createPayment: (value: PaymentWriteRequest) => request<{ id: number }>('/api/admin/payments', 'POST', value),
  changePaymentStatus: (id: number, status: number) =>
    request<void>(`/api/admin/payments/${id}/status`, 'PATCH', { status }),
  refundPayment: (id: number) => request<void>(`/api/admin/payments/${id}/refund`, 'POST'),
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
