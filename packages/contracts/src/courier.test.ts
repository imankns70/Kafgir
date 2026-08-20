import { describe, expect, it } from 'vitest'
import {
  courierDeliveryDayWriteSchema,
  courierSettlementWriteSchema,
  courierWriteSchema,
} from './courier.js'
import { adminOrderDetailSchema, orderSchema } from './index.js'
import { deliveryPricingSchema } from './delivery.js'
import { DeliveryMethod, OrderStatus, PaymentMethod } from './order-enums.js'

describe('courier contracts', () => {
  it('keeps the customer charge and the courier payable as two independent amounts', () => {
    const value = courierDeliveryDayWriteSchema.parse({
      deliveryDate: '2026-08-21',
      courierId: 3,
      customerDeliveryFee: 50_000,
      courierPayablePerOrder: 70_000,
      isActive: true,
    })
    expect(value.customerDeliveryFee).toBe(50_000)
    expect(value.courierPayablePerOrder).toBe(70_000)
  })

  it('holds money as whole Toman', () => {
    expect(() => courierDeliveryDayWriteSchema.parse({
      deliveryDate: '2026-08-21', courierId: 3,
      customerDeliveryFee: 70_000.5, courierPayablePerOrder: 70_000, isActive: true,
    })).toThrow()
  })

  it('rejects negative amounts and empty courier details', () => {
    expect(() => courierDeliveryDayWriteSchema.parse({
      deliveryDate: '2026-08-21', courierId: 3,
      customerDeliveryFee: -1, courierPayablePerOrder: 70_000, isActive: true,
    })).toThrow()
    expect(() => courierWriteSchema.parse({ fullName: '  ', mobile: '09121234567' })).toThrow()
  })

  it('requires a settlement to be a positive amount', () => {
    expect(courierSettlementWriteSchema.parse({ courierId: 1, amount: 500_000 }).amount).toBe(500_000)
    expect(() => courierSettlementWriteSchema.parse({ courierId: 1, amount: 0 })).toThrow()
  })
})

describe('customer-facing payloads never carry the courier payable', () => {
  const order = {
    id: 1,
    orderNumber: '14051',
    customerId: 4,
    customerFullName: 'مشتری',
    customerPhoneNumber: '09121234567',
    status: OrderStatus.Delivered,
    paymentMethod: PaymentMethod.Cash,
    deliveryMethod: DeliveryMethod.Delivery,
    subtotalAmount: 480_000,
    deliveryFee: 70_000,
    totalAmount: 550_000,
    createdAt: '2026-08-20T10:00:00.000Z',
    items: [],
    statusHistories: [],
  }

  /**
   * The guarantee is structural: `orderSchema` has no field the internal amount could occupy, and
   * zod strips anything extra, so even a service that carelessly spread a database row into the
   * customer response could not leak it.
   */
  it('strips a courier payable smuggled into the shared order shape', () => {
    const parsed = orderSchema.parse({ ...order, courierPayableAmount: 70_000, courierId: 9 })
    expect(parsed).not.toHaveProperty('courierPayableAmount')
    expect(parsed).not.toHaveProperty('courierId')
    expect(parsed.deliveryFee).toBe(70_000)
  })

  it('keeps the internal amount on the Admin shape only', () => {
    const parsed = adminOrderDetailSchema.parse({
      ...order, courierId: 9, courierNameSnapshot: 'علی رضایی', courierPayableAmount: 70_000,
    })
    expect(parsed.courierPayableAmount).toBe(70_000)
    expect(parsed.deliveryFee).toBe(70_000)
  })

  it('exposes only the customer charge in the checkout pricing payload', () => {
    const parsed = deliveryPricingSchema.parse({
      deliveryDate: '2026-08-21',
      methods: [{
        method: DeliveryMethod.Delivery,
        requiresCourier: true,
        customerDeliveryFee: 50_000,
        unavailableMessage: null,
        courierPayablePerOrder: 70_000,
      }],
    })
    expect(parsed.methods[0]).not.toHaveProperty('courierPayablePerOrder')
    expect(parsed.methods[0]!.customerDeliveryFee).toBe(50_000)
  })

  it('carries a null fee, not a zero, for a date with no courier configuration', () => {
    const parsed = deliveryPricingSchema.parse({
      deliveryDate: '2026-08-21',
      methods: [{
        method: DeliveryMethod.Delivery,
        requiresCourier: true,
        customerDeliveryFee: null,
        unavailableMessage: 'هزینه و پیک ارسال برای این روز هنوز مشخص نشده است.',
      }],
    })
    expect(parsed.methods[0]!.customerDeliveryFee).toBeNull()
  })
})
