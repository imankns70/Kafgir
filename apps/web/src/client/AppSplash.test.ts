import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppSplash } from './AppSplash'

describe('app splash', () => {
  it('is in the server HTML so it shows before any script runs', () => {
    const markup = renderToStaticMarkup(createElement(AppSplash))
    expect(markup).toContain('class="app-splash"')
    expect(markup).toContain('غذای خونگی، با عشق')
  })
})
