import {
  createOrderSchema,
  accountTransferSchema,
  dailyMenuItemWriteSchema,
  financialAccountWriteSchema,
  financialEntrySchema,
  foodCategoryWriteSchema,
  foodTagWriteSchema,
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
  listFoodTags,
  listIngredients,
  listInventoryMovements,
  listPayments,
  listPosTerminals,
  listPurchases,
  listShoppingLists,
  listSuppliers,
  listUnits,
  managerialReports,
  refundPayment,
  registerWaste,
  registerPurchasePayment,
  removeMenuItem,
  saveFinancialAccount,
  savePosTerminal,
  saveIngredient,
  saveRecipe,
  saveSupplier,
  searchOrders,
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
    case 'foods.list': return listFoods()
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
    case 'orders.search': return searchOrders((body.query ?? {}) as OrderReportQuery)
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
    case 'units.list': return listUnits()
    case 'ingredients.list':
      return listIngredients(typeof body.search === 'string' ? body.search : '')
    case 'ingredients.create': return saveIngredient(null, ingredientWriteSchema.parse(body.value))
    case 'ingredients.update':
      return saveIngredient(numberField(body, 'id'), ingredientWriteSchema.parse(body.value))
    case 'suppliers.list': return listSuppliers()
    case 'suppliers.create': return createSupplierCompat(supplierWriteSchema.parse(body.value))
    case 'suppliers.update':
      return saveSupplier(numberField(body, 'id'), supplierWriteSchema.parse(body.value))
    case 'purchases.list': return listPurchases()
    case 'purchases.create':
      return { id: await createPurchase(purchaseWriteSchema.parse(body.value), principal.userId) }
    case 'purchases.confirm': return confirmPurchase(numberField(body, 'id'), principal.userId)
    case 'purchases.cancel': return cancelPurchase(numberField(body, 'id'), principal.userId)
    case 'purchases.pay':
      return registerPurchasePayment(purchasePaymentWriteSchema.parse(body.value), principal.userId)
    case 'inventory.movements':
      return listInventoryMovements(
        body.ingredientId === undefined ? undefined : Number(body.ingredientId),
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
    case 'finance.transactions': return listFinancialTransactions()
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
    case 'shopping.list': return listShoppingLists()
    case 'shopping.requirements':
      return shoppingRequirements(textField(body, 'from'), textField(body, 'to'))
    case 'shopping.create':
      return { id: await createShoppingList(shoppingListCreateSchema.parse(body.value), principal.userId) }
    case 'payments.list': return listPayments()
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
