import { describe, expect, it } from 'vitest'
import { courierNetLabel } from './CourierPages'
import { isAdminOperationAllowed } from '../../shared/admin-permissions'

describe('courier cash', () => {
  it('says who owes whom instead of showing a signed balance', () => {
    expect(courierNetLabel(0)).toBe('بی‌حساب')
    expect(courierNetLabel(120_000)).toContain('به پیک بدهکار')
    expect(courierNetLabel(-560_000)).toContain('پیک')
    expect(courierNetLabel(-560_000)).not.toContain('-')
  })

  it('lets dispatch receive cash and move orders between couriers, but not pay couriers out', () => {
    expect(isAdminOperationAllowed('courierAccounting.recordCash', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('orders.assignCourier', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('courierAccounting.settle', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('courierAccounting.recordCash', ['KitchenAdmin'])).toBe(false)
  })
})
