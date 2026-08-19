import { describe, expect, it } from 'vitest'
import {
  channelLeftWithoutOption,
  channelLeftWithoutOptionMessage,
} from './checkout-method-rules'

const both = { isCustomerEnabled: true, isManualEnabled: true }

describe('checkout method availability', () => {
  it('allows disabling a method while another still serves the channel', () => {
    expect(channelLeftWithoutOption({ customer: 1, manual: 1 }, {
      isCustomerEnabled: false, isManualEnabled: false,
    })).toBeNull()
  })

  it('refuses switching off the last customer-facing option', () => {
    expect(channelLeftWithoutOption({ customer: 0, manual: 3 }, {
      isCustomerEnabled: false, isManualEnabled: true,
    })).toBe('customer')
  })

  it('refuses switching off the last manual option', () => {
    expect(channelLeftWithoutOption({ customer: 2, manual: 0 }, {
      isCustomerEnabled: true, isManualEnabled: false,
    })).toBe('manual')
  })

  it('reports the customer channel first when both would be emptied', () => {
    // A broken public checkout is the more expensive failure, so it is the one named.
    expect(channelLeftWithoutOption({ customer: 0, manual: 0 }, {
      isCustomerEnabled: false, isManualEnabled: false,
    })).toBe('customer')
  })

  it('never blocks an update that keeps the method enabled', () => {
    expect(channelLeftWithoutOption({ customer: 0, manual: 0 }, both)).toBeNull()
  })

  it('builds a Persian message naming the subject and the channel', () => {
    expect(channelLeftWithoutOptionMessage('روش‌های پرداخت', 'customer'))
      .toBe('روش‌های پرداخت باید دست‌کم یک گزینه فعال برای وب مشتری داشته باشد.')
    expect(channelLeftWithoutOptionMessage('روش‌های دریافت', 'manual'))
      .toBe('روش‌های دریافت باید دست‌کم یک گزینه فعال برای سفارش دستی داشته باشد.')
  })
})
