import { describe, expect, it } from 'vitest'
import {
  createOrderSchema,
  dailyMenuSchema,
  dailyMenuItemWriteSchema,
  DeliveryMethod,
  foodCategoryWriteSchema,
  foodWriteSchema,
  menuCartSnapshotRequestSchema,
  normalizePersianSearch,
  OrderStatus,
  PaymentMethod,
  publicDailyMenuPageSchema,
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

  it('accepts only a positive menu discount below the regular price', () => {
    const base = { foodId: 1, price: 430000, capacityPortions: 10, isAvailable: true }
    expect(dailyMenuItemWriteSchema.safeParse({ ...base, discountPrice: 387000 }).success).toBe(true)
    expect(dailyMenuItemWriteSchema.safeParse({ ...base, discountPrice: null }).success).toBe(true)
    expect(dailyMenuItemWriteSchema.safeParse({ ...base, discountPrice: 430000 }).success).toBe(false)
    expect(dailyMenuItemWriteSchema.safeParse({ ...base, discountPrice: 450000 }).success).toBe(false)
  })

  it('includes customer-visible tag metadata in daily menu items', () => {
    const result = dailyMenuSchema.safeParse({
      id: 1,
      menuDate: '2026-08-01',
      isOpen: true,
      note: null,
      orderDeadline: null,
      categories: [],
      items: [{
        id: 1,
        foodId: 1,
        slug: 'diet-food',
        foodName: 'غذای رژیمی',
        foodDescription: null,
        imageUrl: null,
        category: { id: 1, title: 'رژیمی', slug: 'diet', icon: null },
        primaryBadge: null,
        tags: [{ id: 2, title: 'پروتئین بالا', slug: 'high-protein', icon: null, group: 'diet' }],
        price: 390000,
        capacityPortions: 10,
        soldPortions: 0,
        remainingPortions: 10,
        isAvailable: true,
      }],
    })

    expect(result.success).toBe(true)
    expect(result.success && result.data.items[0]?.tags[0]?.title).toBe('پروتئین بالا')
  })

  it('normalizes Persian search text consistently for client and server', () => {
    expect(normalizePersianSearch('  كَباب‌مرغــ  ')).toBe('کباب مرغ')
    expect(normalizePersianSearch('رژيمي')).toBe('رژیمی')
  })

  it('defaults the public discount showcase to an empty collection', () => {
    const result = publicDailyMenuPageSchema.parse({
      id: 1,
      menuDate: '2026-08-03',
      isOpen: true,
      note: null,
      orderDeadline: null,
      categories: [],
      items: [],
      totalItems: 0,
      nextCursor: null,
    })

    expect(result.discountItems).toEqual([])
  })

  it('refuses to let the Persian rice food offer the upgrade to itself', () => {
    const base = {
      name: 'برنج ایرانی', slug: 'iranian-rice', categoryId: 3, defaultPrice: 55_000,
      tagIds: [], images: [],
    }
    expect(foodWriteSchema.safeParse({ ...base, isPersianRice: true }).success).toBe(true)
    expect(foodWriteSchema.safeParse({ ...base, allowsPersianRice: true }).success).toBe(true)
    expect(foodWriteSchema.safeParse({
      ...base, isPersianRice: true, allowsPersianRice: true,
    }).success).toBe(false)
  })

  it('treats a dish with and without the Persian upgrade as separate cart identities', () => {
    expect(menuCartSnapshotRequestSchema.safeParse({ items: [
      { dailyMenuItemId: 7, withPersianRice: true },
      { dailyMenuItemId: 7, withPersianRice: false },
    ] }).success).toBe(true)
    expect(menuCartSnapshotRequestSchema.safeParse({ items: [
      { dailyMenuItemId: 7, withPersianRice: true },
      { dailyMenuItemId: 7, withPersianRice: true },
    ] }).success).toBe(false)
  })

  it('defaults an order item to plain foreign rice and carries the upgrade when asked', () => {
    const order = (items: unknown) => createOrderSchema.safeParse({
      fullName: 'مشتری', phoneNumber: '09120000000', paymentMethod: PaymentMethod.Cash,
      deliveryMethod: DeliveryMethod.Pickup, items,
    })
    const plain = order([{ dailyMenuItemId: 7, quantity: 2 }])
    expect(plain.success && plain.data.items[0]?.withPersianRice).toBe(false)
    const upgraded = order([{ dailyMenuItemId: 7, withPersianRice: true, quantity: 2 }])
    expect(upgraded.success && upgraded.data.items[0]?.withPersianRice).toBe(true)
  })
})
