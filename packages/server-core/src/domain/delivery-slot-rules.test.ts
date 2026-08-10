import { describe, expect, it } from 'vitest'
import { DeliverySlotUnavailableReason, deliveryTimeSlotWriteSchema } from '@kafgir/contracts'
import {
  deliverySlotUnavailableMessage,
  evaluateSlot,
  minutesOfDay,
  slotCapacity,
  toTimeOfDay,
  type SlotRuleInput,
} from './delivery-slot-rules'

const slot = (overrides: Partial<SlotRuleInput> = {}): SlotRuleInput => ({
  isActiveGlobally: true,
  override: null,
  startTime: '12:00:00',
  orderCutoffMinutesBeforeStart: 60,
  usedOrders: 0,
  ...overrides,
})

// 10:00 on the delivery day, well before the 11:00 cutoff of a 12:00 window.
const beforeCutoff = 10 * 60
const afterCutoff = 11 * 60 + 30

describe('time helpers', () => {
  it('reads PostgreSQL time values', () => {
    expect(minutesOfDay('12:00:00')).toBe(720)
    expect(minutesOfDay('14:30')).toBe(870)
    expect(toTimeOfDay('16:00:00')).toBe('16:00')
  })
})

describe('effective availability', () => {
  it('returns an active slot for a valid date', () => {
    expect(evaluateSlot(slot(), beforeCutoff, true, false)).toBeNull()
  })

  it('rejects a globally inactive slot', () => {
    expect(evaluateSlot(slot({ isActiveGlobally: false }), beforeCutoff, true, false))
      .toBe(DeliverySlotUnavailableReason.Inactive)
  })

  it('rejects a slot disabled for that specific date', () => {
    const disabled = slot({ override: { isAvailable: false, capacityOrders: null } })
    expect(evaluateSlot(disabled, beforeCutoff, true, false))
      .toBe(DeliverySlotUnavailableReason.DisabledForDate)
  })

  it('keeps a globally active slot available when the date override enables it', () => {
    const enabled = slot({ override: { isAvailable: true, capacityOrders: 5 } })
    expect(evaluateSlot(enabled, beforeCutoff, true, false)).toBeNull()
  })

  it('rejects a slot once its cutoff has passed today', () => {
    expect(evaluateSlot(slot(), afterCutoff, true, false))
      .toBe(DeliverySlotUnavailableReason.CutoffPassed)
  })

  it('applies the cutoff only to today, so tomorrow stays open at the same clock time', () => {
    expect(evaluateSlot(slot(), afterCutoff, false, false)).toBeNull()
  })

  it('honours a per-slot cutoff longer than the default', () => {
    const early = slot({ orderCutoffMinutesBeforeStart: 180 })
    expect(evaluateSlot(early, 9 * 60 + 30, true, false))
      .toBe(DeliverySlotUnavailableReason.CutoffPassed)
    expect(evaluateSlot(early, 8 * 60, true, false)).toBeNull()
  })

  it('treats a zero cutoff as open until the window starts', () => {
    const noCutoff = slot({ orderCutoffMinutesBeforeStart: 0 })
    expect(evaluateSlot(noCutoff, 11 * 60 + 59, true, false)).toBeNull()
    expect(evaluateSlot(noCutoff, 12 * 60, true, false))
      .toBe(DeliverySlotUnavailableReason.CutoffPassed)
  })

  it('rejects every slot on a past date', () => {
    expect(evaluateSlot(slot(), 0, false, true)).toBe(DeliverySlotUnavailableReason.CutoffPassed)
  })

  it('allows a slot that still has capacity left', () => {
    const partial = slot({ override: { isAvailable: true, capacityOrders: 20 }, usedOrders: 19 })
    expect(evaluateSlot(partial, beforeCutoff, true, false)).toBeNull()
  })

  it('rejects a slot whose capacity is exactly full', () => {
    const full = slot({ override: { isAvailable: true, capacityOrders: 20 }, usedOrders: 20 })
    expect(evaluateSlot(full, beforeCutoff, true, false))
      .toBe(DeliverySlotUnavailableReason.CapacityFull)
  })

  it('treats a missing capacity as unlimited rather than zero', () => {
    expect(slotCapacity(slot())).toBeNull()
    const busy = slot({ usedOrders: 500 })
    expect(evaluateSlot(busy, beforeCutoff, true, false)).toBeNull()
  })

  it('reports the day being switched off ahead of it being full', () => {
    const both = slot({ override: { isAvailable: false, capacityOrders: 1 }, usedOrders: 99 })
    expect(evaluateSlot(both, beforeCutoff, true, false))
      .toBe(DeliverySlotUnavailableReason.DisabledForDate)
  })

  it('gives every reason customer-facing Persian text', () => {
    for (const reason of [
      DeliverySlotUnavailableReason.Inactive,
      DeliverySlotUnavailableReason.DisabledForDate,
      DeliverySlotUnavailableReason.CutoffPassed,
      DeliverySlotUnavailableReason.CapacityFull,
    ]) {
      expect(deliverySlotUnavailableMessage(reason).length).toBeGreaterThan(0)
    }
    expect(deliverySlotUnavailableMessage(DeliverySlotUnavailableReason.CapacityFull))
      .toContain('ظرفیت این بازه زمانی تکمیل شده است')
  })
})

describe('slot master-data validation', () => {
  const base = { title: 'ظهر', sortOrder: 1, orderCutoffMinutesBeforeStart: 60, isActive: true }

  it('accepts a window that ends after it starts', () => {
    expect(deliveryTimeSlotWriteSchema.safeParse({ ...base, startTime: '12:00', endTime: '14:00' }).success)
      .toBe(true)
  })

  it('rejects an end time equal to the start time', () => {
    expect(deliveryTimeSlotWriteSchema.safeParse({ ...base, startTime: '12:00', endTime: '12:00' }).success)
      .toBe(false)
  })

  it('rejects an end time before the start time', () => {
    expect(deliveryTimeSlotWriteSchema.safeParse({ ...base, startTime: '14:00', endTime: '12:00' }).success)
      .toBe(false)
  })

  it('rejects free-form time text', () => {
    expect(deliveryTimeSlotWriteSchema.safeParse({ ...base, startTime: '۱۲:۰۰', endTime: '14:00' }).success)
      .toBe(false)
    expect(deliveryTimeSlotWriteSchema.safeParse({ ...base, startTime: '25:00', endTime: '26:00' }).success)
      .toBe(false)
  })
})

describe('business timezone', () => {
  it('reads the cutoff clock in Tehran, not the machine timezone', async () => {
    const { businessMinutesOfDay, businessDate } = await import('../time')
    // 08:30 UTC is 12:00 in Tehran (+03:30). A machine running in UTC would say 510.
    const noonTehran = new Date('2026-08-12T08:30:00Z')
    expect(businessMinutesOfDay(noonTehran)).toBe(12 * 60)
    expect(businessDate(noonTehran)).toBe('2026-08-12')
    // 21:00 UTC is already the next day in Tehran (00:30), which is what "today" must follow.
    const lateUtc = new Date('2026-08-12T21:00:00Z')
    expect(businessDate(lateUtc)).toBe('2026-08-13')
    expect(businessMinutesOfDay(lateUtc)).toBe(30)
  })

  it('closes a 12:00 window at 11:00 Tehran regardless of UTC offset', async () => {
    const { businessMinutesOfDay } = await import('../time')
    const justBefore = businessMinutesOfDay(new Date('2026-08-12T07:29:00Z')) // 10:59 Tehran
    const justAfter = businessMinutesOfDay(new Date('2026-08-12T07:31:00Z')) // 11:01 Tehran
    expect(evaluateSlot(slot(), justBefore, true, false)).toBeNull()
    expect(evaluateSlot(slot(), justAfter, true, false))
      .toBe(DeliverySlotUnavailableReason.CutoffPassed)
  })
})
