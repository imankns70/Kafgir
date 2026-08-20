import { describe, expect, it } from 'vitest'
import { adminOperations, type AdminOperation } from './admin-operations'
import { isAdminOperationAllowed } from './admin-permissions'

describe('Admin operation permissions', () => {
  it('allows the owner to use every protected operation', () => {
    expect(isAdminOperationAllowed('payments.refund', ['Owner'])).toBe(true)
    expect(isAdminOperationAllowed('purchases.delete', ['Owner'])).toBe(true)
  })

  it('lets the kitchen record what it bought without opening the courier ledger', () => {
    expect(isAdminOperationAllowed('purchases.create', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('months.get', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('courierAccounting.summary', ['KitchenAdmin'])).toBe(false)
  })

  it('keeps refunds outside order-manager permissions', () => {
    expect(isAdminOperationAllowed('dashboard.analytics', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('payments.changeStatus', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('payments.refund', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('support.conversations.reply', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('support.reviews.setStatus', ['OrderManager'])).toBe(true)
  })

  it('lets order managers read a month but not rewrite what was bought', () => {
    expect(isAdminOperationAllowed('purchases.month', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('months.list', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('purchases.create', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('purchases.delete', ['OrderManager'])).toBe(false)
  })

  it('allows social review for kitchen admins but reserves publishing and configuration for owner', () => {
    expect(isAdminOperationAllowed('social.dashboard', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('social.preview', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('social.posts.publish', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('social.rules.save', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('social.channels.save', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('social.posts.publish', ['Owner'])).toBe(true)
  })

  it('lets dispatch assign the day’s courier but reserves paying one for the owner', () => {
    expect(isAdminOperationAllowed('courierDays.save', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('courierAccounting.summary', ['OrderManager'])).toBe(true)
    // Recording a settlement is money leaving the business.
    expect(isAdminOperationAllowed('courierAccounting.settle', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('courierAccounting.settle', ['Owner'])).toBe(true)
  })

  it('shows the kitchen who is delivering without opening the courier ledger to it', () => {
    expect(isAdminOperationAllowed('couriers.list', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('courierDays.get', ['KitchenAdmin'])).toBe(true)
    expect(isAdminOperationAllowed('courierDays.save', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('couriers.create', ['KitchenAdmin'])).toBe(false)
  })

  /**
   * The inventory, procurement and accounting subsystems were removed. Their permissions had to go
   * with them: a permission that guards nothing is a permission somebody later grants by accident.
   */
  it('has no operations left from the removed inventory and accounting subsystems', () => {
    const removed = [
      'inventory', 'ingredients.', 'suppliers.', 'shopping.', 'recipes.', 'finance.',
      'units.', 'reports.v15', 'dashboard.v15', 'purchases.confirm', 'purchases.cancel',
      'purchases.pay', 'purchases.list',
    ]
    const survivors = (adminOperations as readonly AdminOperation[])
      .filter((operation) => removed.some((prefix) => operation.startsWith(prefix)))
    expect(survivors).toEqual([])
  })
})
