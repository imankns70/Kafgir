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
    expect(isAdminOperationAllowed('dashboard.analytics', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('payments.changeStatus', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('payments.refund', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('inventory.adjust', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('support.conversations.reply', ['OrderManager'])).toBe(true)
    expect(isAdminOperationAllowed('support.reviews.setStatus', ['OrderManager'])).toBe(true)
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
    expect(isAdminOperationAllowed('courierAccounting.summary', ['KitchenAdmin'])).toBe(false)
    expect(isAdminOperationAllowed('couriers.create', ['KitchenAdmin'])).toBe(false)
  })
})
