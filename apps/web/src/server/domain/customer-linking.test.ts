import { describe, expect, it } from 'vitest'
import { isConflictingVerifiedPhoneLink, selectVerifiedPhoneCanonicalUserId } from './customer-linking'

describe('customer identity linking', () => {
  it('accepts an idempotent link to the same account', () => {
    expect(isConflictingVerifiedPhoneLink(
      { userId: 1, telegramUserId: 1001 },
      { userId: 1, telegramUserId: 1001 },
    )).toBe(false)
  })

  it('allows a verified phone-only account to merge into the current Telegram account', () => {
    expect(isConflictingVerifiedPhoneLink(
      { userId: 2, telegramUserId: 1002 },
      { userId: 1, telegramUserId: null },
    )).toBe(false)
  })

  it('rejects moving a verified phone away from another Telegram account', () => {
    expect(isConflictingVerifiedPhoneLink(
      { userId: 2, telegramUserId: 1002 },
      { userId: 1, telegramUserId: 1001 },
    )).toBe(true)
  })

  it('does not claim a Telegram account from an unverified delivery phone match', () => {
    expect(selectVerifiedPhoneCanonicalUserId(
      null,
      null,
      [{ userId: 1, telegramUserId: 1001 }],
    )).toBeNull()
  })

  it('may claim historical phone-only orders after OTP verification', () => {
    expect(selectVerifiedPhoneCanonicalUserId(
      null,
      null,
      [{ userId: 1, telegramUserId: null }],
    )).toBe(1)
  })
})
