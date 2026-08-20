import { describe, expect, it } from 'vitest'
import { DeliveryMethod, PaymentMethod } from './order-enums.js'
import {
  deliveryMethodSettingSchema,
  deliveryMethodSettingWriteSchema,
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
        deliveryFee: 50_000, minimumOrderAmount: 300_000, requiresCourier: true,
      }],
    })
    expect(options.deliveryMethods[0]).toMatchObject({ deliveryFee: 50_000, minimumOrderAmount: 300_000 })
  })

  /**
   * `requiresCourier` describes what the code does with a method, exactly like the enum value does.
   * Leaving it writable would let an operator switch a method's pricing source from a settings
   * screen and produce orders the courier accounting cannot explain.
   */
  it('does not let an operator change whether a method needs a courier', () => {
    const parsed = deliveryMethodSettingWriteSchema.parse({
      title: 'ارسال', description: null, isCustomerEnabled: true, isManualEnabled: true,
      displayOrder: 10, deliveryFee: 0, minimumOrderAmount: 0, requiresCourier: false,
    })
    expect(parsed).not.toHaveProperty('requiresCourier')
  })
})
