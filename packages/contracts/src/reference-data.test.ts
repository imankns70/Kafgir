import { describe, expect, it } from 'vitest'
import { DeliveryMethod, PaymentMethod } from './order-enums.js'
import {
  deliveryMethodSettingSchema,
  paymentMethodSettingSchema,
  publicOrderOptionsSchema,
} from './reference-data.js'

describe('reference data contracts', () => {
  it('preserves every historic order payment code', () => {
    expect(paymentMethodSettingSchema.parse({
      method: PaymentMethod.CardToCard,
      title: 'کارت‌به‌کارت',
      description: null,
      isCustomerEnabled: false,
      isManualEnabled: true,
      displayOrder: 20,
    }).method).toBe(2)
  })

  it('rejects unknown payment and delivery behavior codes', () => {
    const common = { title: 'ناشناخته', isCustomerEnabled: true, isManualEnabled: true, displayOrder: 0 }
    expect(() => paymentMethodSettingSchema.parse({ method: 99, ...common })).toThrow()
    expect(() => deliveryMethodSettingSchema.parse({
      method: 99, ...common, deliveryFee: 0, minimumOrderAmount: 0,
    })).toThrow()
  })

  it('exposes enabled checkout options with configurable delivery amounts', () => {
    const options = publicOrderOptionsSchema.parse({
      paymentMethods: [{
        method: PaymentMethod.Cash, title: 'نقدی', description: null,
        isCustomerEnabled: true, isManualEnabled: true, displayOrder: 10,
      }],
      deliveryMethods: [{
        method: DeliveryMethod.Delivery, title: 'ارسال', description: 'ارسال به آدرس مشتری',
        isCustomerEnabled: true, isManualEnabled: true, displayOrder: 10,
        deliveryFee: 50_000, minimumOrderAmount: 300_000,
      }],
    })
    expect(options.deliveryMethods[0]).toMatchObject({ deliveryFee: 50_000, minimumOrderAmount: 300_000 })
  })
})
