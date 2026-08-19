import {
  createOrderSchema,
  accountTransferSchema,
  dailyMenuItemWriteSchema,
  financialAccountWriteSchema,
  financialEntrySchema,
  foodCategoryWriteSchema,
  foodTagWriteSchema,
  foodTagGroupWriteSchema,
  foodWriteSchema,
  ingredientWriteSchema,
  inventoryAdjustmentSchema,
  purchaseWriteSchema,
  paymentStatusWriteSchema,
  paymentWriteSchema,
  posTerminalWriteSchema,
  purchasePaymentWriteSchema,
  recipeWriteSchema,
  shoppingListCreateSchema,
  stockCountSchema,
  supplierWriteSchema,
  updateDailyMenuItemSchema,
  updateDailyMenuSettingsSchema,
  updateOrderStatusSchema,
  deliveryTimeSlotWriteSchema,
  deliveryDayOverrideWriteSchema,
  wasteWriteSchema,
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
  unitWriteSchema,
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
  adjustInventory,
  confirmPurchase,
  confirmStockCount,
  createFinancialEntry,
  createFood,
  createFoodCategory,
  createFoodTag,
  createOrder,
  createPurchase,
  createPayment,
  createShoppingList,
  cancelPurchase,
  getDashboard,
  getCustomerAnalyticsToday,
  getMenuByDate,
  getOrder,
  getRecipe,
  listFinancialAccounts,
  listExpenseCategories,
  listFinancialTransactions,
  listFoodCategories,
  listFoods,
  listFoodsPaged,
  listFoodTags,
  listIngredients,
  listIngredientsPaged,
  listInventoryMovements,
  listPayments,
  paymentBucketTotals,
  type PaymentBucket,
  listPosTerminals,
  listPurchases,
  listShoppingLists,
  listShoppingListsPaged,
  listSuppliers,
  listSuppliersPaged,
  listUnits,
  saveUnit,
  managerialReports,
  getCustomerReport,
  searchCustomers,
  getCustomerDetail,
  refundPayment,
  registerWaste,
  registerPurchasePayment,
  removeMenuItem,
  saveFinancialAccount,
  savePosTerminal,
  saveIngredient,
  saveRecipe,
  saveSupplier,
  searchOrdersPaged,
  setFoodActive,
  shoppingRequirements,
  updateFood,
  updateFoodCategory,
  updateFoodTag,
  updateMenuItem,
  updateMenuSettings,
  updateOrderStatus,
  v15Dashboard,
  changePaymentStatus,
  transfer,
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
    case 'dashboard.v15': return v15Dashboard()
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
    case 'customers.lookup': return findCustomerByPhone(textField(body, 'phoneNumber'))
    case 'orders.search': return searchOrdersPaged((body.query ?? {}) as OrderReportQuery)
    case 'orders.get': return getOrder(numberField(body, 'id'))
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
    case 'units.list': return listUnits()
    case 'units.save':
      return saveUnit(body.id == null ? null : numberField(body, 'id'), unitWriteSchema.parse(body.value))
    case 'ingredients.list':
      return wantsPaging(body)
        ? listIngredientsPaged(searchArg(body), undefined, pageArg(body), sizeArg(body))
        : listIngredients(searchArg(body))
    case 'ingredients.create': return saveIngredient(null, ingredientWriteSchema.parse(body.value))
    case 'ingredients.update':
      return saveIngredient(numberField(body, 'id'), ingredientWriteSchema.parse(body.value))
    case 'suppliers.list':
      return wantsPaging(body)
        ? listSuppliersPaged(searchArg(body), pageArg(body), sizeArg(body))
        : listSuppliers(searchArg(body))
    case 'suppliers.create': return createSupplierCompat(supplierWriteSchema.parse(body.value))
    case 'suppliers.update':
      return saveSupplier(numberField(body, 'id'), supplierWriteSchema.parse(body.value))
    case 'purchases.list':
      return listPurchases(body.status == null ? undefined : Number(body.status), body.page == null ? undefined : Number(body.page), body.pageSize == null ? undefined : Number(body.pageSize))
    case 'purchases.create':
      return { id: await createPurchase(purchaseWriteSchema.parse(body.value), principal.userId) }
    case 'purchases.confirm': return confirmPurchase(numberField(body, 'id'), principal.userId)
    case 'purchases.cancel': return cancelPurchase(numberField(body, 'id'), principal.userId)
    case 'purchases.pay':
      return registerPurchasePayment(purchasePaymentWriteSchema.parse(body.value), principal.userId)
    case 'inventory.movements':
      return listInventoryMovements(
        body.ingredientId === undefined ? undefined : Number(body.ingredientId),
        body.page == null ? undefined : Number(body.page),
        body.pageSize == null ? undefined : Number(body.pageSize),
      )
    case 'inventory.adjust':
      return adjustInventory(inventoryAdjustmentSchema.parse(body.value), principal.userId)
    case 'inventory.waste': return registerWaste(wasteWriteSchema.parse(body.value), principal.userId)
    case 'inventory.count':
      return confirmStockCount(stockCountSchema.parse(body.value), principal.userId)
    case 'recipes.get': return getRecipe(numberField(body, 'foodId'))
    case 'recipes.save':
      return saveRecipe(
        numberField(body, 'foodId'),
        recipeWriteSchema.parse(body.value),
        principal.userId,
      )
    case 'finance.accounts': return listFinancialAccounts()
    case 'finance.expenseCategories': return listExpenseCategories()
    case 'finance.createAccount':
      return saveFinancialAccount(null, financialAccountWriteSchema.parse(body.value))
    case 'finance.updateAccount':
      return saveFinancialAccount(numberField(body, 'id'), financialAccountWriteSchema.parse(body.value))
    case 'finance.transactions':
      return listFinancialTransactions(
        typeof body.from === 'string' ? body.from : undefined,
        typeof body.to === 'string' ? body.to : undefined,
        body.page == null ? undefined : Number(body.page), body.pageSize == null ? undefined : Number(body.pageSize))
    case 'finance.createEntry':
      return createFinancialEntry(
        financialEntrySchema.parse(body.value),
        body.kind === 'income' ? 'income' : 'expense',
        principal.userId,
      )
    case 'finance.transfer':
      return transfer(accountTransferSchema.parse(body.value), principal.userId)
    case 'finance.posTerminals': return listPosTerminals()
    case 'finance.createPosTerminal': return savePosTerminal(null, posTerminalWriteSchema.parse(body.value))
    case 'finance.updatePosTerminal':
      return savePosTerminal(numberField(body, 'id'), posTerminalWriteSchema.parse(body.value))
    case 'shopping.list':
      return wantsPaging(body)
        ? listShoppingListsPaged(searchArg(body), pageArg(body), sizeArg(body))
        : listShoppingLists(searchArg(body))
    case 'shopping.requirements':
      return shoppingRequirements(textField(body, 'from'), textField(body, 'to'))
    case 'shopping.create':
      return { id: await createShoppingList(shoppingListCreateSchema.parse(body.value), principal.userId) }
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
    case 'reports.v15': return managerialReports(textField(body, 'from'), textField(body, 'to'))
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

async function createSupplierCompat(value: Parameters<typeof saveSupplier>[1]) {
  await saveSupplier(null, value)
}

export { closeDatabase }
