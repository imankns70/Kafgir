import { describe, expect, it } from 'vitest'
import {
  CustomerPaymentMethod,
  accountTransferSchema,
  inventoryAdjustmentSchema,
  paymentWriteSchema,
  purchaseWriteSchema,
  recipeWriteSchema,
} from './v15.js'

describe('Kafgir v1.5 contracts', () => {
  it('keeps POS and card-to-card as distinct payment methods', () => {
    expect(CustomerPaymentMethod.Pos).not.toBe(CustomerPaymentMethod.CardToCard)
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
      orderId: 1, paymentMethod: CustomerPaymentMethod.CardToCard,
      financialAccountId: 1, amount: 1000, receiptImageUrl: '/receipt.webp',
    })
    expect(payment).not.toHaveProperty('status')
  })

  it('requires at least one recipe ingredient', () => {
    expect(recipeWriteSchema.safeParse({
      yieldQuantity: 10, overheadPerPortion: 0, isActive: true, items: [],
    }).success).toBe(false)
  })
})
