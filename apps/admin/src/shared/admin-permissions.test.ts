import { describe, expect, it } from 'vitest'
import { isAdminOperationAllowed } from './admin-permissions'

describe('Admin operation permissions', () => {
  it('allows the owner to use every protected operation', () => {
    expect(isAdminOperationAllowed('payments.refund', ['Owner'])).toBe(true)
    expect(isAdminOperationAllowed('inventory.count', ['Owner'])).toBe(true)
  })

  it('lets kitchen administrators load accounts for purchase payments but not alter finance', () => {
    expect(isAdminOperationAllowed('purchases.pay', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('finance.accounts', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('finance.createEntry', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('shopping.list', ['KitchenAdmin'])).toBe(true)
  })

  it('keeps refunds and inventory changes outside order-manager permissions', () => {
    expect(isAdminOperationAllowed('payments.changeStatus', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('payments.refund', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('inventory.adjust', ['OrderManager'])).toBe(false)
  })
})
