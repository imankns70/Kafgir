import { describe, expect, it } from 'vitest'
import {
  CustomerPaymentMethod,
  accountTransferSchema,
  inventoryAdjustmentSchema,
  paymentWriteSchema,
  purchaseWriteSchema,
  recipeWriteSchema,
  shoppingListSummarySchema,
  stockCountSchema,
} from './v15.js'

describe('Kafgir v1.5 contracts', () => {
  it('keeps finance payment values aligned with order payment values', () => {
    expect(CustomerPaymentMethod.Cash).toBe(1)
    expect(CustomerPaymentMethod.OnlineGateway).toBe(3)
    expect(CustomerPaymentMethod.Pos).toBe(4)
  })

  it('requires explicit purchase conversion and positive decimal quantities', () => {
    const base = {
      supplierId: null, purchaseDate: '2026-07-29', discountAmount: 0,
      additionalCostAmount: 0, items: [{
        ingredientId: 1, purchaseUnitId: 2, quantity: '10',
        conversionFactorToBaseUnit: '1000', unitPrice: 500_000, lineDiscountAmount: 0,
      }],
    }
    expect(purchaseWriteSchema.safeParse(base).success).toBe(true)
    expect(purchaseWriteSchema.safeParse({
      ...base, items: [{ ...base.items[0], conversionFactorToBaseUnit: '0' }],
    }).success).toBe(false)
    expect(purchaseWriteSchema.safeParse({
      ...base, items: [{ ...base.items[0], lineDiscountAmount: 5_000_001 }],
    }).success).toBe(false)
  })

  it('rejects floating-point inventory payloads in favor of decimal strings', () => {
    expect(inventoryAdjustmentSchema.safeParse({
      ingredientId: 1, type: 'increase', quantity: 0.1, reason: 'اصلاح',
    }).success).toBe(false)
  })

  it('requires different financial accounts for transfers', () => {
    expect(accountTransferSchema.safeParse({
      fromAccountId: 1, toAccountId: 1, amount: 1000, description: 'انتقال',
    }).success).toBe(false)
  })

  it('does not treat receipt upload as paid', () => {
    const payment = paymentWriteSchema.parse({
      orderId: 1, paymentMethod: CustomerPaymentMethod.OnlineGateway,
      financialAccountId: 1, amount: 1000, receiptImageUrl: '/receipt.webp',
    })
    expect(payment).not.toHaveProperty('status')
  })

  it('requires at least one recipe ingredient', () => {
    expect(recipeWriteSchema.safeParse({
      yieldQuantity: 10, overheadPerPortion: 0, isActive: true, items: [],
    }).success).toBe(false)
  })

  it('rejects duplicate ingredients in recipes and stock counts', () => {
    expect(recipeWriteSchema.safeParse({
      yieldQuantity: 10, overheadPerPortion: 0, items: [
        { ingredientId: 1, quantityInBaseUnit: '2' },
        { ingredientId: 1, quantityInBaseUnit: '3' },
      ],
    }).success).toBe(false)
    expect(stockCountSchema.safeParse({
      items: [
        { ingredientId: 1, countedQuantity: '2' },
        { ingredientId: 1, countedQuantity: '3' },
      ],
    }).success).toBe(false)
  })

  it('validates saved shopping-list summaries returned to Admin', () => {
    expect(shoppingListSummarySchema.safeParse({
      id: 1,
      title: 'لیست خرید آموزشی',
      targetDate: '2026-08-02',
      status: 1,
      notes: null,
      itemCount: 4,
      estimatedTotal: 8_388_000,
      itemSummary: 'برنج هاشمی ایرانی، مرغ کامل تازه',
      createdAt: '2026-08-01T08:30:00.000Z',
    }).success).toBe(true)
  })
})
