import { describe, expect, it } from 'vitest'
import { OrderStatus } from '@kafgir/contracts'
import {
  isAllowedOrderTransition,
  normalizePhone,
  optionalText,
  remainingPortions,
} from './order-rules'

describe('order rules', () => {
  it.each([
    [OrderStatus.PendingConfirmation, OrderStatus.Confirmed],
    [OrderStatus.PendingConfirmation, OrderStatus.Cancelled],
    [OrderStatus.Confirmed, OrderStatus.Preparing],
    [OrderStatus.Confirmed, OrderStatus.Delivered],
    [OrderStatus.Confirmed, OrderStatus.Cancelled],
    [OrderStatus.Preparing, OrderStatus.Ready],
    [OrderStatus.Preparing, OrderStatus.Cancelled],
    [OrderStatus.Ready, OrderStatus.Delivered],
    [OrderStatus.Ready, OrderStatus.Cancelled],
  ])('allows transition %i -> %i', (current, next) => {
    expect(isAllowedOrderTransition(current, next)).toBe(true)
  })

  it.each([
    [OrderStatus.PendingConfirmation, OrderStatus.Delivered],
    [OrderStatus.Confirmed, OrderStatus.PendingConfirmation],
    [OrderStatus.Preparing, OrderStatus.Delivered],
    [OrderStatus.Ready, OrderStatus.Preparing],
    [OrderStatus.Delivered, OrderStatus.Cancelled],
    [OrderStatus.Cancelled, OrderStatus.Confirmed],
    [OrderStatus.Delivered, OrderStatus.Delivered],
  ])('rejects transition %i -> %i', (current, next) => {
    expect(isAllowedOrderTransition(current, next)).toBe(false)
  })

  it('normalizes Persian digits and punctuation', () => {
    expect(normalizePhone('۰۹۱۶-۰۰۰ ۰۰۰۰')).toBe('09160000000')
  })

  it('normalizes Arabic digits', () => {
    expect(normalizePhone('٠٩١٦ ١٢٣ ٤٥٦٧')).toBe('09161234567')
  })

  it('keeps an international prefix', () => {
    expect(normalizePhone('+98 (916) 123-4567')).toBe('+989161234567')
  })

  it('returns null for blank optional text', () => {
    expect(optionalText('   ')).toBeNull()
  })

  it('trims nonblank optional text', () => {
    expect(optionalText('  خانه  ')).toBe('خانه')
  })

  it('subtracts sold portions from capacity', () => {
    expect(remainingPortions(25, 7)).toBe(18)
  })
})
