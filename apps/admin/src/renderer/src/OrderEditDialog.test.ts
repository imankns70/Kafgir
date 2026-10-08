import { describe, expect, it } from 'vitest'
import { OrderStatus } from '@kafgir/contracts'
import { editedSubtotal, isOrderEditable, isOrderReopenable, menuChoices } from './OrderEditDialog'

describe('order correction rules in the UI', () => {
  it('offers editing only before the kitchen starts, and reopening only from a final status', () => {
    expect([1, 2, 3, 4, 5, 6].filter((status) => isOrderEditable(status as OrderStatus)))
      .toEqual([OrderStatus.PendingConfirmation, OrderStatus.Confirmed])
    expect([1, 2, 3, 4, 5, 6].filter((status) => isOrderReopenable(status as OrderStatus)))
      .toEqual([OrderStatus.Delivered, OrderStatus.Cancelled])
  })

  it('totals the edited lines and lists Persian rice beside the dishes', () => {
    expect(editedSubtotal([{ unitPrice: 400_000, quantity: 2 }, { unitPrice: 90_000, quantity: 1 }])).toBe(890_000)
    const choices = menuChoices({
      items: [{ id: 7, foodName: 'قیمه', price: 300_000, remainingPortions: 4 }],
      persianRice: { menuItemId: 9, title: 'برنج ایرانی', price: 90_000, remainingPortions: 10 },
    } as never)
    expect(choices.map((choice) => choice.name)).toEqual(['قیمه', 'برنج ایرانی'])
    expect(menuChoices(null)).toEqual([])
  })
})
