import {
  createOrderSchema,
  dailyMenuItemWriteSchema,
  foodCategoryWriteSchema,
  foodTagWriteSchema,
  foodTagGroupWriteSchema,
  foodWriteSchema,
  purchaseWriteSchema,
  paymentStatusWriteSchema,
  paymentWriteSchema,
  updateDailyMenuItemSchema,
  updateDailyMenuSettingsSchema,
  updateOrderStatusSchema,
  deliveryTimeSlotWriteSchema,
  deliveryDayOverrideWriteSchema,
  courierWriteSchema,
  courierDeliveryDayWriteSchema,
  courierSettlementWriteSchema,
  socialChannelWriteSchema,
  socialPostWriteSchema,
  socialRuleWriteSchema,
  socialSettingsWriteSchema,
  socialTemplateWriteSchema,
  orderReviewHandlingStatusSchema,
  supportConversationStatusSchema,
  supportConversationCloseSchema,
  supportMessageWriteSchema,
  supportSubjectWriteSchema,
  customerReportQuerySchema,
  customerDirectoryQuerySchema,
  paymentMethodSettingWriteSchema,
  deliveryMethodSettingWriteSchema,
  PaymentMethod,
  DeliveryMethod,
  type OrderReportQuery,
} from '@kafgir/contracts'
import {
  addMenuItem,
  createDeliveryTimeSlot,
  getDeliveryDay,
  listDeliveryTimeSlots,
  setDeliveryDayOverride,
  setDeliveryTimeSlotActive,
  updateDeliveryTimeSlot,
  createFood,
  createFoodCategory,
  createFoodTag,
  createOrder,
  createPayment,
  getDashboard,
  getMonthPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  listRecentMonths,
  getMonthlyReport,
  getCustomerAnalyticsToday,
  getMenuByDate,
  listFoodCategories,
  listFoods,
  listFoodsPaged,
  listFoodTags,
  listPayments,
  paymentBucketTotals,
  type PaymentBucket,
  getCustomerReport,
  searchCustomers,
  getCustomerDetail,
  refundPayment,
  removeMenuItem,
  searchOrdersPaged,
  setFoodActive,
  updateFood,
  updateFoodCategory,
  updateFoodTag,
  updateMenuItem,
  updateMenuSettings,
  updateOrderStatus,
  changePaymentStatus,
  closeDatabase,
  testDatabaseConnection,
  type AdminPrincipal,
  createSocialPost,
  dismissSocialSuggestion,
  evaluateSocialAutomation,
  generateSocialDraft,
  getSocialDashboard,
  getSocialSettings,
  listSocialChannels,
  listSocialHistory,
  listSocialRules,
  listSocialSuggestions,
  listSocialTemplates,
  previewSocialPost,
  publishSocialPost,
  retrySocialTarget,
  saveSocialChannel,
  saveSocialRule,
  saveSocialSettings,
  saveSocialTemplate,
  testSocialChannelConnection,
  findCustomerByPhone,
  addAdminSupportMessage,
  getAdminSupportConversation,
  listAdminOrderReviews,
  listAdminSupportConversations,
  replyToOrderReview,
  setAdminOrderReviewStatus,
  setAdminSupportConversationClosed,
  createFoodTagGroup,
  updateFoodTagGroup,
  listFoodTagGroups,
  createSupportSubject,
  updateSupportSubject,
  listSupportSubjects,
  listPaymentMethodSettings,
  updatePaymentMethodSetting,
  listDeliveryMethodSettings,
  updateDeliveryMethodSetting,
  listCouriers,
  createCourier,
  updateCourier,
  setCourierActive,
  getCourierDeliveryDay,
  listCourierDeliveryDays,
  saveCourierDeliveryDay,
  courierAccountSummaries,
  listCourierSettlements,
  recordCourierSettlement,
  getAdminOrderDetail,
} from '@kafgir/server-core'
import { readServerLogs } from '@kafgir/server-core/logging/read-logs'
import type { AdminOperation } from '../shared/admin-operations'
import { isAdminOperationAllowed } from '../shared/admin-permissions'
import { encryptSocialCredential, resolveSocialCredential } from './social-credentials'

type RecordPayload = Record<string, unknown>

const payloadRecord = (payload: unknown) => (payload ?? {}) as RecordPayload
const numberField = (payload: unknown, key: string) => {
  const value = Number(payloadRecord(payload)[key])
  if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid ${key}.`)
  return value
}
const textField = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key]
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${key}.`)
  return value
}

function authorizeOperation(operation: AdminOperation, principal: AdminPrincipal) {
  if (!isAdminOperationAllowed(operation, principal.roles)) {
    throw new Error('برای انجام این عملیات مجوز کافی ندارید.')
  }
}

/** Paging and search arrive as untyped IPC fields; every grid reads them the same way. */
const pageArg = (body: RecordPayload) => (body.page == null ? undefined : Number(body.page))
const sizeArg = (body: RecordPayload) => (body.pageSize == null ? undefined : Number(body.pageSize))
const searchArg = (body: RecordPayload) => (typeof body.search === 'string' ? body.search : '')
/**
 * These four lists feed both a paginated grid and picker dropdowns that need every row.
 * Paging params present means a grid is asking; absent means a picker is.
 */
const wantsPaging = (body: RecordPayload) => body.page != null || body.pageSize != null

export async function dispatchAdminOperation(
  operation: AdminOperation,
  payload: unknown,
  principal: AdminPrincipal | null,
) {
  if (operation === 'health') {
    await testDatabaseConnection()
    return { status: 'ok' }
  }
  if (!principal) throw new Error('ابتدا وارد حساب مدیریت شوید.')
  authorizeOperation(operation, principal)
  const body = payloadRecord(payload)
  switch (operation) {
    case 'dashboard.today': return getDashboard()
    case 'dashboard.analytics': return getCustomerAnalyticsToday()
    case 'foodCategories.list': return listFoodCategories(true)
    case 'foodCategories.create': return createFoodCategory(foodCategoryWriteSchema.parse(body.value))
    case 'foodCategories.update':
      return updateFoodCategory(numberField(body, 'id'), foodCategoryWriteSchema.parse(body.value))
    case 'foodTags.list': return listFoodTags(true)
    case 'foodTags.create': return createFoodTag(foodTagWriteSchema.parse(body.value))
    case 'foodTags.update': return updateFoodTag(numberField(body, 'id'), foodTagWriteSchema.parse(body.value))
    case 'foodTagGroups.list': return listFoodTagGroups(true)
    case 'foodTagGroups.create': return createFoodTagGroup(foodTagGroupWriteSchema.parse(body.value))
    case 'foodTagGroups.update':
      return updateFoodTagGroup(textField(body, 'code'), foodTagGroupWriteSchema.parse(body.value))
    case 'supportSubjects.list': return listSupportSubjects(true)
    case 'supportSubjects.create': return createSupportSubject(supportSubjectWriteSchema.parse(body.value))
    case 'supportSubjects.update':
      return updateSupportSubject(numberField(body, 'id'), supportSubjectWriteSchema.parse(body.value))
    case 'paymentMethods.list': return listPaymentMethodSettings('all')
    case 'deliveryMethods.list': return listDeliveryMethodSettings('all')
    case 'paymentMethods.update':
      return updatePaymentMethodSetting(
        Number(body.method) as PaymentMethod,
        paymentMethodSettingWriteSchema.parse(body.value),
      )
    case 'deliveryMethods.update':
      return updateDeliveryMethodSetting(
        Number(body.method) as DeliveryMethod,
        deliveryMethodSettingWriteSchema.parse(body.value),
      )
    case 'foods.list':
      return wantsPaging(body)
        ? listFoodsPaged(searchArg(body), pageArg(body), sizeArg(body))
        : listFoods(searchArg(body))
    case 'foods.create': return createFood(foodWriteSchema.parse(body.value))
    case 'foods.update': return updateFood(numberField(body, 'id'), foodWriteSchema.parse(body.value))
    case 'foods.setActive':
      return setFoodActive(numberField(body, 'id'), Boolean(body.isActive))
    case 'menus.get': return getMenuByDate(textField(body, 'date'))
    case 'menus.settings':
      return updateMenuSettings(textField(body, 'date'), updateDailyMenuSettingsSchema.parse(body.value))
    case 'menus.addItem':
      return addMenuItem(textField(body, 'date'), dailyMenuItemWriteSchema.parse(body.value))
    case 'menus.updateItem':
      return updateMenuItem(numberField(body, 'id'), updateDailyMenuItemSchema.parse(body.value))
    case 'menus.removeItem': return removeMenuItem(numberField(body, 'id'))
    case 'deliverySlots.list': return listDeliveryTimeSlots()
    case 'deliverySlots.create':
      return createDeliveryTimeSlot(deliveryTimeSlotWriteSchema.parse(body.value))
    case 'deliverySlots.update':
      return updateDeliveryTimeSlot(numberField(body, 'id'), deliveryTimeSlotWriteSchema.parse(body.value))
    case 'deliverySlots.setActive':
      return setDeliveryTimeSlotActive(numberField(body, 'id'), Boolean(body.isActive))
    case 'deliveryDays.get': return getDeliveryDay(textField(body, 'date'))
    case 'deliveryDays.setOverride':
      return setDeliveryDayOverride(deliveryDayOverrideWriteSchema.parse(body.value))
    case 'couriers.list': return listCouriers(true)
    case 'couriers.create': return createCourier(courierWriteSchema.parse(body.value))
    case 'couriers.update':
      return updateCourier(numberField(body, 'id'), courierWriteSchema.parse(body.value))
    case 'couriers.setActive':
      return setCourierActive(numberField(body, 'id'), Boolean(body.isActive))
    case 'courierDays.get': return getCourierDeliveryDay(textField(body, 'date'))
    case 'courierDays.list': return listCourierDeliveryDays()
    case 'courierDays.save':
      return saveCourierDeliveryDay(courierDeliveryDayWriteSchema.parse(body.value))
    case 'courierAccounting.summary': return courierAccountSummaries()
    case 'courierAccounting.settlements':
      return listCourierSettlements(numberField(body, 'courierId'))
    case 'courierAccounting.settle':
      return recordCourierSettlement(courierSettlementWriteSchema.parse(body.value))
    case 'customers.lookup': return findCustomerByPhone(textField(body, 'phoneNumber'))
    case 'orders.search': return searchOrdersPaged((body.query ?? {}) as OrderReportQuery)
    // Admin's detail view, which adds the courier and the courier payable snapshot on top of the
    // customer-safe order.
    case 'orders.get': return getAdminOrderDetail(numberField(body, 'id'))
    case 'orders.create':
      return createOrder(createOrderSchema.parse(body.value), {
        userId: null,
        username: null,
        firstName: null,
        lastName: null,
      }, true)
    case 'orders.updateStatus':
      return updateOrderStatus(
        numberField(body, 'id'),
        updateOrderStatusSchema.parse(body.value),
        principal.userId,
      )
    case 'support.conversations.list':
      return listAdminSupportConversations(body.status == null
        ? undefined : supportConversationStatusSchema.parse(Number(body.status)))
    case 'support.conversations.get':
      return getAdminSupportConversation(numberField(body, 'id'))
    case 'support.conversations.reply':
      return addAdminSupportMessage(principal.userId, numberField(body, 'id'), supportMessageWriteSchema.parse(body.value))
    case 'support.conversations.setClosed': {
      const value = supportConversationCloseSchema.parse(body.value)
      return setAdminSupportConversationClosed(principal.userId, numberField(body, 'id'), value.closed)
    }
    case 'support.reviews.list':
      return listAdminOrderReviews({
        handlingStatus: body.status == null
          ? null : orderReviewHandlingStatusSchema.parse(Number(body.status)),
        rating: body.rating == null ? null : Number(body.rating),
        from: typeof body.from === 'string' ? body.from : null,
        to: typeof body.to === 'string' ? body.to : null,
        search: searchArg(body) || null,
        page: pageArg(body),
        pageSize: sizeArg(body),
      })
    case 'support.reviews.setStatus':
      return setAdminOrderReviewStatus(
        principal.userId,
        numberField(body, 'id'),
        orderReviewHandlingStatusSchema.parse(Number(body.status)),
      )
    case 'support.reviews.reply':
      return replyToOrderReview(principal.userId, numberField(body, 'id'), supportMessageWriteSchema.parse(body.value))
    // Purchases: write one down, correct one, remove one, and read a month's worth.
    case 'purchases.month':
      return getMonthPurchases(numberField(body, 'year'), numberField(body, 'month'))
    case 'purchases.create':
      return createPurchase(purchaseWriteSchema.parse(body.value), principal.userId)
    case 'purchases.update':
      return updatePurchase(numberField(body, 'id'), purchaseWriteSchema.parse(body.value), principal.userId)
    case 'purchases.delete':
      return deletePurchase(numberField(body, 'id'), principal.userId)
    case 'months.list': return listRecentMonths()
    case 'months.get':
      return getMonthlyReport(numberField(body, 'year'), numberField(body, 'month'))
    case 'payments.list':
      return listPayments(
        typeof body.bucket === 'string' ? body.bucket as PaymentBucket : undefined,
        body.page == null ? undefined : Number(body.page),
        body.pageSize == null ? undefined : Number(body.pageSize),
      )
    case 'payments.totals': return paymentBucketTotals()
    case 'payments.create':
      return { id: await createPayment(paymentWriteSchema.parse(body.value), principal.userId) }
    case 'payments.changeStatus':
      return changePaymentStatus(
        numberField(body, 'id'),
        paymentStatusWriteSchema.parse({ status: Number(body.status) }),
        principal.userId,
      )
    case 'payments.refund': return refundPayment(numberField(body, 'id'), principal.userId)
    case 'customers.search': return searchCustomers(customerDirectoryQuerySchema.parse(body.value))
    case 'customers.detail': return getCustomerDetail(numberField(body, 'id'))
    case 'reports.customers': {
      const query = customerReportQuerySchema.parse(body.value)
      return getCustomerReport(query.from, query.to)
    }
    case 'logs.server': return readServerLogs(Number(body.limit ?? 500))
    case 'social.dashboard': return getSocialDashboard()
    case 'social.channels.list': return listSocialChannels()
    case 'social.channels.save': {
      const value = socialChannelWriteSchema.parse(body.value)
      const encrypted = value.credential ? encryptSocialCredential(value.credential) : undefined
      return saveSocialChannel(body.id == null ? null : numberField(body, 'id'), value, encrypted)
    }
    case 'social.channels.test':
      return testSocialChannelConnection(numberField(body, 'id'), resolveSocialCredential)
    case 'social.templates.list': return listSocialTemplates()
    case 'social.templates.save': return saveSocialTemplate(socialTemplateWriteSchema.parse(body.value))
    case 'social.draft.generate': return generateSocialDraft(body.value)
    case 'social.preview': return previewSocialPost(socialPostWriteSchema.parse(body.value))
    case 'social.posts.create': return createSocialPost(socialPostWriteSchema.parse(body.value), principal.userId)
    case 'social.posts.publish':
      return publishSocialPost(numberField(body, 'id'), resolveSocialCredential)
    case 'social.suggestions.list':
      return listSocialSuggestions(typeof body.date === 'string' ? body.date : undefined)
    case 'social.suggestions.dismiss':
      return dismissSocialSuggestion(numberField(body, 'id'), principal.userId)
    case 'social.automation.evaluate': {
      const result = await evaluateSocialAutomation(new Date(), principal.userId)
      for (const postId of result.autoPublishPostIds) {
        await publishSocialPost(postId, resolveSocialCredential)
      }
      return result
    }
    case 'social.rules.list': return listSocialRules()
    case 'social.rules.save':
      return saveSocialRule(body.id == null ? null : numberField(body, 'id'), socialRuleWriteSchema.parse(body.value))
    case 'social.settings.get': return getSocialSettings()
    case 'social.settings.save': return saveSocialSettings(socialSettingsWriteSchema.parse(body.value))
    case 'social.history': return listSocialHistory(body.query ?? {})
    case 'social.targets.retry':
      return retrySocialTarget(numberField(body, 'id'), resolveSocialCredential)
  }
}

export { closeDatabase }
