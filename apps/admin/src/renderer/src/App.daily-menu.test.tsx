import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DailyMenuPage, MenuItemSetupPage } from './App'

describe('today menu editor', () => {
  it('lets the operator add a food when nothing was planned for today', () => {
    const markup = renderToStaticMarkup(createElement(DailyMenuPage))
    expect(markup).toContain('انتخاب غذا')
    expect(markup).toContain('افزودن به منوی امروز')
    expect(markup).not.toContain('ابتدا آن را در «برنامه ماهانه» ثبت کنید')
  })

  it('opens a reserved row on its own page with a way back to today\'s menu', () => {
    const markup = renderToStaticMarkup(createElement(MenuItemSetupPage, { itemId: 7, startDiscount: false, onDone: () => {} }))
    expect(markup).toContain('بازگشت به منوی امروز')
  })
})
