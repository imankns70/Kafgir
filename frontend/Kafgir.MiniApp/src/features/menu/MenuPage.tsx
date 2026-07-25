import type { CartItem, DailyMenuDto, DailyMenuItemDto } from '../../types'
import { BrandedState } from '../../design-system/BrandedState'
import { Icon } from '../../design-system/Icon'
import { MenuItemCard } from './MenuItemCard'
import { useMemo, useState } from 'react'

type Props = {
  menu: DailyMenuDto | null
  isLoading: boolean
  error: string | null
  cartItems: CartItem[]
  onRetry: () => void
  onAdd: (item: DailyMenuItemDto) => void
  onQuantityChange: (id: number, quantity: number) => void
}
type MenuCategory = { key: string; label: string; keywords: string[] }

const menuCategories: MenuCategory[] = [
  { key: 'rice', label: 'پلو و خورشت', keywords: ['پلو', 'چلو', 'خورشت', 'خورش', 'برنج', 'زرشک', 'قیمه', 'قرمه'] },
  { key: 'stew', label: 'خوراک و مرغ', keywords: ['خوراک', 'مرغ', 'گوشت', 'کباب', 'کتلت', 'کوکو'] },
  { key: 'light', label: 'سبک و سالم', keywords: ['سالاد', 'سوپ', 'آش', 'سبزی', 'عدسی', 'لوبیا'] },
]

function getItemCategory(item: DailyMenuItemDto) {
  const text = `${item.foodName} ${item.foodDescription ?? ''}`
  return menuCategories.find((category) => category.keywords.some((keyword) => text.includes(keyword)))?.key ?? 'other'
}

export function MenuPage({ menu, isLoading, error, cartItems, onRetry, onAdd, onQuantityChange }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const availableItems = useMemo(
    () => menu?.items.filter((item) => item.isAvailable && item.remainingPortions > 0) ?? [],
    [menu],
  )
  const visibleCategoryOptions = useMemo(() => {
    const keys = new Set(availableItems.map(getItemCategory))
    return [
      { key: 'all', label: 'همه غذاها' },
      ...menuCategories.filter((category) => keys.has(category.key)).map(({ key, label }) => ({ key, label })),
      ...(keys.has('other') ? [{ key: 'other', label: 'غذاهای دیگر' }] : []),
    ]
  }, [availableItems])
  const selectedCategoryExists = visibleCategoryOptions.some((category) => category.key === selectedCategory)
  const effectiveCategory = selectedCategoryExists ? selectedCategory : 'all'
  const filteredItems = effectiveCategory === 'all'
    ? availableItems
    : availableItems.filter((item) => getItemCategory(item) === effectiveCategory)
  const cartQuantities = useMemo(
    () => new Map(cartItems.map((item) => [item.dailyMenuItemId, item.quantity])),
    [cartItems],
  )

  if (isLoading) return <BrandedState title="در حال چیدن سفره امروز…" message="چند لحظه صبر کنید تا غذاهای تازه را بیاوریم." />
  if (error) return <BrandedState title="دریافت منو ممکن نشد" message={error} tone="error" icon="info"><button className="outline-button" onClick={onRetry}><Icon name="refresh" size="md" />تلاش دوباره</button></BrandedState>
  if (!menu) return <BrandedState title="امروز منویی ثبت نشده است" message="به‌زودی غذاهای خانگی تازه اینجا قرار می‌گیرند." />
  if (!menu.isOpen) return <BrandedState title="سفارش‌گیری امروز بسته است" message="برای منوی بعدی دوباره به کفگیر سر بزنید." tone="warning" icon="clock" />

  return <main>
    <section className="menu-intro">
      <div className="menu-intro-copy">
        <span className="eyebrow"><Icon name="freshIngredients" size="sm" /> سفره امروز کفگیر</span>
        <h1 className="section-title">طعم خونه،<br /><span>آماده سفارش</span></h1>
        <p className="section-subtitle">{menu.note || 'غذای تازه و خانگی در اندیمشک'}</p>
        <div className="menu-intro-promises" aria-label="ویژگی‌های غذای امروز">
          <span><Icon name="clock" size="sm" /> پخت روز</span>
          <span><Icon name="freshIngredients" size="sm" /> مواد تازه</span>
        </div>
      </div>
      <div className="menu-intro-accent" aria-hidden="true"><i /><i /><i /></div>
    </section>
    {availableItems.length > 0 && (
      <section id="menu-categories" className="category-strip" aria-label="دسته‌بندی غذاهای امروز">
        <div className="category-strip-title">
          <Icon name="categories" size="sm" />
          <span>دسته‌بندی</span>
        </div>
        <div className="category-chips" role="list">
          {visibleCategoryOptions.map((category) => (
            <button
              key={category.key}
              type="button"
              className={effectiveCategory === category.key ? 'category-chip active' : 'category-chip'}
              onClick={() => setSelectedCategory(category.key)}
              aria-pressed={effectiveCategory === category.key}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>
    )}
    {availableItems.length === 0
      ? <BrandedState title="غذای قابل سفارش باقی نمانده است" message="ممنون که امروز مهمان سفره کفگیر بودید." icon="food" />
      : <div className="menu-grid">{filteredItems.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          quantity={cartQuantities.get(item.id) ?? 0}
          onAdd={onAdd}
          onQuantityChange={onQuantityChange}
        />
      ))}</div>}
  </main>
}
