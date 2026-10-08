import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OrderItemList } from './ActiveOrderTracker'
import type { CustomerOrderSummaryDto } from './types'

const order = (foodItems: CustomerOrderSummaryDto['foodItems']) => ({
  foodSummary: 'fallback', foodItems,
}) as CustomerOrderSummaryDto

const line = (id: number, foodName: string, quantity: number, flags: { allowsPersianRice?: boolean; isPersianRice?: boolean } = {}) => ({
  id, dailyMenuItemId: id, foodName, unitPrice: 100, quantity, totalPrice: 100 * quantity, ...flags,
})

describe('active order item list', () => {
  it('lists each food on its own row with its quantity', () => {
    const html = renderToStaticMarkup(createElement(OrderItemList, { order: order([line(1, 'قیمه', 2), line(2, 'قورمه‌سبزی', 1)]) }))
    expect(html.match(/<li>/g)).toHaveLength(2)
    expect(html).toContain('قیمه')
    expect(html).toContain('قورمه‌سبزی')
  })

  it('folds the Persian-rice add-on into its dish as a tag instead of a separate row', () => {
    const html = renderToStaticMarkup(createElement(OrderItemList, { order: order([
      line(1, 'زرشک‌پلو', 1, { allowsPersianRice: true }),
      line(2, 'برنج ایرانی', 1, { isPersianRice: true }),
    ]) }))
    expect(html.match(/<li>/g)).toHaveLength(1)
    expect(html).toContain('با برنج ایرانی')
    expect(html).not.toContain('(با برنج ایرانی)')
  })

  it('falls back to the summary text when no item rows came back', () => {
    expect(renderToStaticMarkup(createElement(OrderItemList, { order: order([]) }))).toContain('fallback')
  })
})
