import { describe, expect, it } from 'vitest'
import { splitIngredients } from './FoodDetailPage'

describe('splitIngredients', () => {
  it('turns the admin ingredient sentence into separate chips', () => {
    expect(splitIngredients('برنج ایرانی، ران مرغ، زرشک, زعفران، فلفل و زردچوبه.'))
      .toEqual(['برنج ایرانی', 'ران مرغ', 'زرشک', 'زعفران', 'فلفل و زردچوبه'])
  })

  it('shows nothing when no ingredients were entered', () => {
    expect(splitIngredients(null)).toEqual([])
    expect(splitIngredients(' ، ')).toEqual([])
  })
})
