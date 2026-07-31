import { describe, expect, it } from 'vitest'
import {
  createOrderSchema,
  DeliveryMethod,
  foodCategoryWriteSchema,
  foodWriteSchema,
  OrderStatus,
  PaymentMethod,
} from './index'

describe('shared contracts', () => {
  it('preserves public enum values', () => {
    expect(OrderStatus.PendingConfirmation).toBe(1)
    expect(OrderStatus.Cancelled).toBe(6)
    expect(DeliveryMethod.Delivery).toBe(2)
    expect(PaymentMethod.CardToCard).toBe(2)
  })

  it('rejects an order without items', () => {
    const result = createOrderSchema.safeParse({
      fullName: 'کاربر',
      phoneNumber: '09120000000',
      city: 'اندیمشک',
      paymentMethod: PaymentMethod.CardToCard,
      deliveryMethod: DeliveryMethod.Pickup,
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('validates category slugs', () => {
    expect(foodCategoryWriteSchema.safeParse({
      title: 'برنجی', slug: 'rice-food', icon: '🍚', displayOrder: 1, isActive: true,
    }).success).toBe(true)
    expect(foodCategoryWriteSchema.safeParse({
      title: 'برنجی', slug: 'عنوان', icon: null, displayOrder: 1, isActive: true,
    }).success).toBe(false)
  })

  it('rejects a primary badge that is not assigned to the food', () => {
    const result = foodWriteSchema.safeParse({
      name: 'غذای تست',
      slug: 'test-food',
      categoryId: 1,
      tagIds: [2],
      primaryBadgeTagId: 3,
      images: [],
      defaultPrice: 0,
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate tag assignments and multiple primary images', () => {
    const result = foodWriteSchema.safeParse({
      name: 'غذای تست',
      slug: 'test-food',
      categoryId: 1,
      tagIds: [2, 2],
      images: [
        { imageUrl: '/one.webp', altText: 'یک', displayOrder: 0, isPrimary: true },
        { imageUrl: '/two.webp', altText: 'دو', displayOrder: 1, isPrimary: true },
      ],
      defaultPrice: 0,
      isActive: true,
    })
    expect(result.success).toBe(false)
  })
})
