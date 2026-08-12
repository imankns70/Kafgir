import { z } from 'zod'

const id = z.number().int().positive()
const optionalText = z.string().trim().max(2000).nullable().optional()
const decimalQuantity = z.string().regex(/^\d+(?:\.\d{1,6})?$/, 'مقدار باید عددی با حداکثر 6 رقم اعشار باشد.')
const quantity = decimalQuantity.refine((value) => Number(value) > 0, 'مقدار باید بیشتر از صفر باشد.')
const money = z.number().nonnegative().multipleOf(0.01)
const isoDate = z.string().date()

export enum PurchaseStatus { Draft = 1, Confirmed = 2, Cancelled = 3 }
export enum PurchasePaymentStatus { Unpaid = 1, PartiallyPaid = 2, Paid = 3 }
export enum InventoryTransactionType {
  PurchaseIn = 1, ProductionConsumption = 2, WasteOut = 3, ManualIncrease = 4,
  ManualDecrease = 5, StockCountAdjustment = 6, PurchaseReversal = 7,
  OrderCancellationReversal = 8,
}
export enum ShoppingListStatus { Draft = 1, InProgress = 2, Completed = 3, Cancelled = 4 }
export enum FinancialAccountType { Cash = 1, Bank = 2, GatewaySettlement = 3, PettyCash = 4, Other = 5 }
// Keep these values identical to the order PaymentMethod enum in index.ts.
export enum CustomerPaymentMethod { Cash = 1, OnlineGateway = 3, Pos = 4 }
export enum PurchasePaymentMethod { Cash = 1, Bank = 2, Card = 3, Other = 4 }
export enum PaymentStatus {
  Pending = 1, AwaitingVerification = 2, Paid = 3, Failed = 4,
  Rejected = 5, Cancelled = 6, Refunded = 7,
}
export enum FinancialTransactionType {
  SalesIncome = 1, PurchaseExpense = 2, ManualIncome = 3, ManualExpense = 4,
  TransferIn = 5, TransferOut = 6, Refund = 7, Reversal = 8,
}

export const unitSchema = z.object({
  id, name: z.string(), symbol: z.string(), isActive: z.boolean(),
  createdAt: z.string(), updatedAt: z.string(),
})
export const unitWriteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().min(1).max(20),
  isActive: z.boolean().default(true),
})
export const ingredientCategorySchema = z.object({
  id, name: z.string(), isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
})
export const ingredientCategoryWriteSchema = z.object({
  name: z.string().trim().min(1).max(100), isActive: z.boolean().default(true),
})
export const ingredientSchema = z.object({
  id, name: z.string(), code: z.string().nullable(), categoryId: id.nullable(),
  categoryName: z.string().nullable(), baseUnitId: id, baseUnitName: z.string(),
  minimumStockLevel: z.string(), preferredStockLevel: z.string().nullable(),
  isInventoryTracked: z.boolean(), isActive: z.boolean(), notes: z.string().nullable(),
  currentStock: z.string(), latestPurchasePrice: z.number().nullable(),
  weightedAverageCost: z.number(), createdAt: z.string(), updatedAt: z.string(),
})
export const ingredientWriteSchema = z.object({
  name: z.string().trim().min(1).max(150), code: z.string().trim().max(50).nullable().optional(),
  categoryId: id.nullable().optional(), baseUnitId: id,
  minimumStockLevel: decimalQuantity.default('0'), preferredStockLevel: decimalQuantity.nullable().optional(),
  isInventoryTracked: z.boolean().default(true), isActive: z.boolean().default(true), notes: optionalText,
})
export const supplierSchema = z.object({
  id, name: z.string(), contactName: z.string().nullable(), mobile: z.string().nullable(),
  phone: z.string().nullable(), address: z.string().nullable(), notes: z.string().nullable(),
  isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
})
export const supplierWriteSchema = z.object({
  name: z.string().trim().min(1).max(150), contactName: z.string().trim().max(150).nullable().optional(),
  mobile: z.string().trim().max(30).nullable().optional(), phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(), notes: optionalText,
  isActive: z.boolean().default(true),
})
export const purchaseItemWriteSchema = z.object({
  ingredientId: id, purchaseUnitId: id, quantity, conversionFactorToBaseUnit: quantity,
  unitPrice: money, lineDiscountAmount: money.default(0), expirationDate: isoDate.nullable().optional(),
  batchNumber: z.string().trim().max(100).nullable().optional(), notes: optionalText,
}).superRefine((value, context) => {
  if (value.lineDiscountAmount > Number(value.quantity) * value.unitPrice) {
    context.addIssue({ code: 'custom', path: ['lineDiscountAmount'], message: 'تخفیف ردیف نمی‌تواند از مبلغ ردیف بیشتر باشد.' })
  }
})
export const purchaseWriteSchema = z.object({
  supplierId: id.nullable().optional(), invoiceNumber: z.string().trim().max(100).nullable().optional(),
  purchaseDate: isoDate, discountAmount: money.default(0), additionalCostAmount: money.default(0),
  notes: optionalText, attachmentUrl: z.string().trim().max(2000).nullable().optional(),
  items: z.array(purchaseItemWriteSchema).min(1),
})
export const purchaseSchema = z.object({
  id, purchaseNumber: z.string(), supplierId: id.nullable(), supplierName: z.string().nullable(),
  invoiceNumber: z.string().nullable(), purchaseDate: isoDate, status: z.nativeEnum(PurchaseStatus),
  subtotalAmount: z.number(), discountAmount: z.number(), additionalCostAmount: z.number(),
  totalAmount: z.number(), paidAmount: z.number(), paymentStatus: z.nativeEnum(PurchasePaymentStatus),
  notes: z.string().nullable(), attachmentUrl: z.string().nullable(), createdAt: z.string(),
  confirmedAt: z.string().nullable(), items: z.array(z.object({
    id, ingredientId: id, ingredientName: z.string(), purchaseUnitId: id, purchaseUnitName: z.string(),
    quantity: z.string(), conversionFactorToBaseUnit: z.string(), baseUnitQuantity: z.string(),
    unitPrice: z.number(), lineDiscountAmount: z.number(), lineTotalAmount: z.number(),
    expirationDate: z.string().nullable(), batchNumber: z.string().nullable(), notes: z.string().nullable(),
  })),
})
export const purchaseSummarySchema = purchaseSchema.pick({
  id: true, purchaseNumber: true, supplierId: true, supplierName: true, invoiceNumber: true,
  purchaseDate: true, status: true, subtotalAmount: true, discountAmount: true,
  additionalCostAmount: true, totalAmount: true, paidAmount: true, paymentStatus: true,
  notes: true, attachmentUrl: true, createdAt: true, confirmedAt: true,
})
export const inventoryMovementSchema = z.object({
  id, ingredientId: id, ingredientName: z.string(), transactionType: z.nativeEnum(InventoryTransactionType),
  quantityInBaseUnit: z.string(), unitCost: z.number(), totalCost: z.number(),
  referenceType: z.string(), referenceId: z.number().int().nullable(), transactionDate: z.string(),
  notes: z.string().nullable(), reversedTransactionId: z.number().int().nullable(), createdAt: z.string(),
})
export const inventoryAdjustmentSchema = z.object({
  ingredientId: id, type: z.enum(['increase', 'decrease']), quantity,
  reason: z.string().trim().min(1).max(250), notes: optionalText,
  transactionDate: z.string().datetime().optional(),
})
export const wasteWriteSchema = z.object({
  ingredientId: id, quantity, reason: z.enum([
    'فساد', 'سوختگی', 'ریزش', 'اشتباه در پخت', 'مصرف شخصی', 'بسته‌بندی آسیب‌دیده', 'سایر',
  ]), notes: optionalText, transactionDate: z.string().datetime().optional(),
})
export const stockCountSchema = z.object({
  items: z.array(z.object({ ingredientId: id, countedQuantity: decimalQuantity })).min(1),
  notes: optionalText,
}).superRefine((value, context) => {
  const ids = new Set<number>()
  value.items.forEach((item, index) => {
    if (ids.has(item.ingredientId)) {
      context.addIssue({ code: 'custom', path: ['items', index, 'ingredientId'], message: 'هر ماده در انبارگردانی فقط یک‌بار مجاز است.' })
    }
    ids.add(item.ingredientId)
  })
})
export const recipeWriteSchema = z.object({
  yieldQuantity: z.number().int().positive(), preparationLossPercent: z.number().min(0).max(99.99).nullable().optional(),
  overheadPerPortion: money.default(0), notes: optionalText, isActive: z.boolean().default(true),
  items: z.array(z.object({
    ingredientId: id, quantityInBaseUnit: quantity,
    wastePercent: z.number().min(0).max(99.99).nullable().optional(), notes: optionalText,
  })).min(1),
}).superRefine((value, context) => {
  const ids = new Set<number>()
  value.items.forEach((item, index) => {
    if (ids.has(item.ingredientId)) {
      context.addIssue({ code: 'custom', path: ['items', index, 'ingredientId'], message: 'هر ماده در دستور پخت فقط یک‌بار مجاز است.' })
    }
    ids.add(item.ingredientId)
  })
})
export const recipeSchema = z.object({
  id, foodId: id, foodName: z.string(), yieldQuantity: z.number().int(),
  preparationLossPercent: z.number().nullable(), overheadPerPortion: z.number(),
  notes: z.string().nullable(), isActive: z.boolean(), totalRecipeCost: z.number(),
  costPerPortion: z.number(), salePrice: z.number().nullable(), estimatedGrossProfit: z.number().nullable(),
  marginPercent: z.number().nullable(), items: z.array(z.object({
    id, ingredientId: id, ingredientName: z.string(), unitName: z.string(),
    quantityInBaseUnit: z.string(), quantityPerPortion: z.string(), wastePercent: z.number().nullable(),
    weightedAverageCost: z.number(), ingredientCost: z.number(), notes: z.string().nullable(),
  })),
})
export const financialAccountSchema = z.object({
  id, name: z.string(), type: z.nativeEnum(FinancialAccountType), bankName: z.string().nullable(),
  cardNumberMasked: z.string().nullable(), accountNumberMasked: z.string().nullable(),
  ibanMasked: z.string().nullable(), openingBalance: z.number(), currentBalance: z.number(),
  isActive: z.boolean(), notes: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
})
export const financialAccountWriteSchema = z.object({
  name: z.string().trim().min(1).max(150), type: z.nativeEnum(FinancialAccountType),
  bankName: z.string().trim().max(100).nullable().optional(), cardNumberMasked: z.string().trim().max(30).nullable().optional(),
  accountNumberMasked: z.string().trim().max(40).nullable().optional(), ibanMasked: z.string().trim().max(40).nullable().optional(),
  openingBalance: money.default(0), isActive: z.boolean().default(true), notes: optionalText,
})
export const expenseCategorySchema = z.object({
  id, name: z.string(), isActive: z.boolean(), createdAt: z.string(),
})
export const posTerminalSchema = z.object({
  id, title: z.string(), terminalNumber: z.string(), merchantNumber: z.string().nullable(),
  financialAccountId: id, financialAccountName: z.string(), isActive: z.boolean(), notes: z.string().nullable(),
})
export const posTerminalWriteSchema = z.object({
  title: z.string().trim().min(1).max(150), terminalNumber: z.string().trim().min(1).max(100),
  merchantNumber: z.string().trim().max(100).nullable().optional(), financialAccountId: id,
  isActive: z.boolean().default(true), notes: optionalText,
})
export const paymentWriteSchema = z.object({
  orderId: id, paymentMethod: z.nativeEnum(CustomerPaymentMethod), financialAccountId: id,
  posTerminalId: id.nullable().optional(), amount: money.positive(),
  trackingNumber: z.string().trim().max(100).nullable().optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  receiptImageUrl: z.string().trim().max(2000).nullable().optional(), description: optionalText,
})
export const paymentStatusWriteSchema = z.object({
  status: z.nativeEnum(PaymentStatus), description: optionalText,
})
export const customerPaymentSchema = z.object({
  id, orderId: id, orderNumber: z.string(), customerFullName: z.string(),
  customerPhoneNumber: z.string(), orderTotalAmount: money,
  paymentMethod: z.nativeEnum(CustomerPaymentMethod), amount: money,
  status: z.nativeEnum(PaymentStatus), financialAccountId: id,
  financialAccountName: z.string(), posTerminalId: id.nullable(),
  trackingNumber: z.string().nullable(), referenceNumber: z.string().nullable(),
  receiptImageUrl: z.string().nullable(), description: z.string().nullable(),
  paidAt: z.string().nullable(), createdAt: z.string(),
})
export const financialEntrySchema = z.object({
  financialAccountId: id, amount: money.positive(), transactionDate: z.string().datetime().optional(),
  categoryId: id.nullable().optional(), description: z.string().trim().min(1).max(1000),
})
export const accountTransferSchema = z.object({
  fromAccountId: id, toAccountId: id, amount: money.positive(),
  transactionDate: z.string().datetime().optional(), description: z.string().trim().min(1).max(1000),
}).refine((value) => value.fromAccountId !== value.toAccountId, 'حساب مبدأ و مقصد باید متفاوت باشند.')
export const purchasePaymentWriteSchema = z.object({
  purchaseId: id, financialAccountId: id, amount: money.positive(),
  paymentMethod: z.nativeEnum(PurchasePaymentMethod),
  paidAt: z.string().datetime().optional(), trackingNumber: z.string().trim().max(100).nullable().optional(),
  notes: optionalText,
})
export const shoppingRequirementsSchema = z.object({
  from: isoDate, to: isoDate,
})
export const shoppingListCreateSchema = z.object({
  title: z.string().trim().min(1).max(200), targetDate: isoDate,
  notes: optionalText, items: z.array(z.object({
    ingredientId: id, requiredQuantity: quantity, currentStockSnapshot: decimalQuantity,
    suggestedPurchaseQuantity: decimalQuantity, estimatedUnitCost: money,
  })).min(1),
})
export const shoppingListSummarySchema = z.object({
  id, title: z.string(), targetDate: isoDate, status: z.nativeEnum(ShoppingListStatus),
  notes: z.string().nullable(), itemCount: z.number().int().nonnegative(),
  estimatedTotal: z.number().nonnegative(), itemSummary: z.string(), createdAt: z.string(),
})

export type UnitDto = z.infer<typeof unitSchema>
export type UnitWriteRequest = z.infer<typeof unitWriteSchema>
export type IngredientCategoryDto = z.infer<typeof ingredientCategorySchema>
export type IngredientCategoryWriteRequest = z.infer<typeof ingredientCategoryWriteSchema>
export type IngredientDto = z.infer<typeof ingredientSchema>
export type IngredientWriteRequest = z.infer<typeof ingredientWriteSchema>
export type SupplierDto = z.infer<typeof supplierSchema>
export type SupplierWriteRequest = z.infer<typeof supplierWriteSchema>
export type PurchaseDto = z.infer<typeof purchaseSchema>
export type PurchaseSummaryDto = z.infer<typeof purchaseSummarySchema>
export type PurchaseWriteRequest = z.infer<typeof purchaseWriteSchema>
export type InventoryMovementDto = z.infer<typeof inventoryMovementSchema>
export type InventoryAdjustmentRequest = z.infer<typeof inventoryAdjustmentSchema>
export type WasteWriteRequest = z.infer<typeof wasteWriteSchema>
export type StockCountRequest = z.infer<typeof stockCountSchema>
export type RecipeDto = z.infer<typeof recipeSchema>
export type RecipeWriteRequest = z.infer<typeof recipeWriteSchema>
export type FinancialAccountDto = z.infer<typeof financialAccountSchema>
export type FinancialAccountWriteRequest = z.infer<typeof financialAccountWriteSchema>
export type ExpenseCategoryDto = z.infer<typeof expenseCategorySchema>
export type PosTerminalDto = z.infer<typeof posTerminalSchema>
export type PosTerminalWriteRequest = z.infer<typeof posTerminalWriteSchema>
export type PaymentWriteRequest = z.infer<typeof paymentWriteSchema>
export type PaymentStatusWriteRequest = z.infer<typeof paymentStatusWriteSchema>
export type CustomerPaymentDto = z.infer<typeof customerPaymentSchema>
export type FinancialEntryRequest = z.infer<typeof financialEntrySchema>
export type AccountTransferRequest = z.infer<typeof accountTransferSchema>
export type PurchasePaymentWriteRequest = z.infer<typeof purchasePaymentWriteSchema>
export type ShoppingRequirementsRequest = z.infer<typeof shoppingRequirementsSchema>
export type ShoppingListCreateRequest = z.infer<typeof shoppingListCreateSchema>
export type ShoppingListSummaryDto = z.infer<typeof shoppingListSummarySchema>
