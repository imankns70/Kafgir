import { OrderStatus } from '@kafgir/contracts'
import { describe, expect, it } from 'vitest'
import {
  courierDayMissingMessage,
  courierOutstanding,
  courierSnapshotFor,
  effectiveCustomerDeliveryFee,
  isCourierEarningStatus,
  settlementRejection,
  type CourierDayPricing,
} from './courier-rules'
import { isAllowedOrderTransition } from './order-rules'

const day = (customerDeliveryFee: number, courierPayablePerOrder: number): CourierDayPricing => ({
  courierDeliveryDayId: 1,
  courierId: 7,
  courierName: 'علی رضایی',
  customerDeliveryFee,
  courierPayablePerOrder,
})

describe('effective customer delivery fee', () => {
  it('prices a courier method from that day, not from the delivery-method record', () => {
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: true, methodDeliveryFee: 25_000, courierDay: day(70_000, 70_000),
    })).toBe(70_000)
  })

  it('prices a non-courier method from the delivery-method record', () => {
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: false, methodDeliveryFee: 0, courierDay: day(70_000, 70_000),
    })).toBe(0)
  })

  it('refuses to price a courier method on a day nobody configured, rather than charging zero', () => {
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: true, methodDeliveryFee: 25_000, courierDay: null,
    })).toBeNull()
    expect(courierDayMissingMessage).toContain('هزینه و پیک ارسال')
  })

  it('needs no courier configuration for a pickup order', () => {
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: false, methodDeliveryFee: 0, courierDay: null,
    })).toBe(0)
    expect(courierSnapshotFor({
      requiresCourier: false, methodDeliveryFee: 0, courierDay: day(70_000, 70_000),
    })).toBeNull()
  })
})

describe('customer charge and courier payable are independent', () => {
  it('keeps the two amounts apart when they differ', () => {
    const configuration = day(50_000, 70_000)
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: true, methodDeliveryFee: 0, courierDay: configuration,
    })).toBe(50_000)
    expect(courierSnapshotFor({
      requiresCourier: true, methodDeliveryFee: 0, courierDay: configuration,
    })!.courierPayablePerOrder).toBe(70_000)
  })

  it('supports free delivery that the courier is still paid for', () => {
    const configuration = day(0, 70_000)
    expect(effectiveCustomerDeliveryFee({
      requiresCourier: true, methodDeliveryFee: 0, courierDay: configuration,
    })).toBe(0)
    expect(courierSnapshotFor({
      requiresCourier: true, methodDeliveryFee: 0, courierDay: configuration,
    })!.courierPayablePerOrder).toBe(70_000)
  })
})

describe('courier earning statuses', () => {
  it('counts only a delivered order', () => {
    expect(isCourierEarningStatus(OrderStatus.Delivered)).toBe(true)
  })

  it.each([
    ['PendingConfirmation', OrderStatus.PendingConfirmation],
    ['Confirmed', OrderStatus.Confirmed],
    ['Preparing', OrderStatus.Preparing],
    ['Ready', OrderStatus.Ready],
    ['Cancelled', OrderStatus.Cancelled],
  ])('does not count %s', (_label, status) => {
    expect(isCourierEarningStatus(status)).toBe(false)
  })

  /**
   * Current-status accounting is only deterministic while Delivered is terminal. If a backward
   * transition is ever added, earnings would need an event ledger — this test is what will notice.
   */
  it('has no transition out of Delivered, which is what makes current-status accounting safe', () => {
    const everyStatus = [
      OrderStatus.PendingConfirmation, OrderStatus.Confirmed, OrderStatus.Preparing,
      OrderStatus.Ready, OrderStatus.Delivered, OrderStatus.Cancelled,
    ]
    for (const next of everyStatus) {
      expect(isAllowedOrderTransition(OrderStatus.Delivered, next)).toBe(false)
    }
  })
})

describe('courier balance', () => {
  it('derives the outstanding balance from work done minus money paid', () => {
    expect(courierOutstanding({ earnedAmount: 1_260_000, settledAmount: 700_000 })).toBe(560_000)
  })

  it('reduces the outstanding balance as settlements accumulate', () => {
    const earned = 1_260_000
    expect(courierOutstanding({ earnedAmount: earned, settledAmount: 700_000 })).toBe(560_000)
    expect(courierOutstanding({ earnedAmount: earned, settledAmount: 1_200_000 })).toBe(60_000)
  })

  it('accepts a settlement up to the full outstanding balance', () => {
    expect(settlementRejection(500_000, 560_000)).toBeNull()
    expect(settlementRejection(560_000, 560_000)).toBeNull()
  })

  it('refuses a settlement that would drive the balance negative', () => {
    expect(settlementRejection(600_000, 560_000)).toContain('مانده')
  })

  it('refuses a zero or negative settlement', () => {
    expect(settlementRejection(0, 560_000)).toContain('بیشتر از صفر')
    expect(settlementRejection(-1, 560_000)).toContain('بیشتر از صفر')
  })
})
