import { describe, expect, it } from 'vitest'
import { newOrderMessage } from './new-order-alerts'

describe('newOrderMessage', () => {
  it('names one order with its customer and total', () => {
    const message = newOrderMessage([{ orderNumber: '1405-482917', customerFullName: 'فائزه', totalAmount: 975000 }])
    expect(message.title).toBe('سفارش تازه 1405-482917')
    expect(message.body).toContain('فائزه')
    expect(message.body).toContain('975,000')
  })
  it('counts several orders and lists their numbers', () => {
    const message = newOrderMessage([
      { orderNumber: '1405-1', customerFullName: 'a', totalAmount: 1 },
      { orderNumber: '1405-2', customerFullName: 'b', totalAmount: 2 },
    ])
    expect(message.title).toBe('2 سفارش تازه')
    expect(message.body).toBe('1405-1، 1405-2')
  })
})
