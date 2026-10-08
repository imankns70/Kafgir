import { describe, expect, it } from 'vitest'
import { isAdminOperationAllowed } from '../../shared/admin-permissions'
import { generatePassword } from './StaffPage'

describe('staff management', () => {
  it('generates readable passwords without look-alike characters', () => {
    const password = generatePassword(12)
    expect(password).toHaveLength(12)
    expect(password).not.toMatch(/[0O1lI]/u)
  })

  it('keeps account management with the owner', () => {
    expect(isAdminOperationAllowed('staff.update', ['Owner'])).toBe(true)
    expect(isAdminOperationAllowed('staff.list', ['OrderManager'])).toBe(false)
    expect(isAdminOperationAllowed('staff.resetPassword', ['KitchenAdmin'])).toBe(false)
  })
})
