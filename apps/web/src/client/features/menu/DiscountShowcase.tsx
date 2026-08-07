import { useRef, useState } from 'react'
import type { CartItem, DailyMenuItemDto, PersianRiceDto } from '../../types'
import { FoodImage } from '../../design-system/FoodImage'
import { Icon } from '../../design-system/Icon'
import { PriceDisplay } from '../../design-system/PriceDisplay'
import { formatMoney, formatNumber } from '../../utils/format'

type Props = {
  items: DailyMenuItemDto[]
  persianRice: PersianRiceDto | null
  cartItems: CartItem[]
  onAdd: (item: DailyMenuItemDto, withPersianRice?: boolean) => void
  onQuantityChange: (id: number, quantity: number, withPersianRice?: boolean) => void
}

function DiscountCard({ item, persianRice, cartItems, onAdd, onQuantityChange }: {
  item: DailyMenuItemDto
  persianRice: PersianRiceDto | null
  cartItems: CartItem[]
  onAdd: Props['onAdd']
  onQuantityChange: Props['onQuantityChange']
}) {
  // Same rule as the menu grid card: the checkbox chooses the next add, the stepper follows the
  // selected variant, and the other variant is named instead of folded into one misleading count.
  const [withPersianRice, setWithPersianRice] = useState(false)
  const detailUrl = `/foods/${item.slug}?menuItemId=${item.id}`
  const lines = cartItems.filter((line) => line.dailyMenuItemId === item.id)
  const upgradedInCart = lines.some((line) => line.withPersianRice)
  const riceAvailable = Boolean(persianRice?.isAvailable && persianRice.remainingPortions > 0)
  const offersRice = item.allowsPersianRice && persianRice != null
  const quantity = lines.find((line) => Boolean(line.withPersianRice) === withPersianRice)?.quantity ?? 0
  const otherLine = lines.find((line) => Boolean(line.withPersianRice) !== withPersianRice)
  const maximum = withPersianRice && persianRice
    ? Math.min(item.remainingPortions, persianRice.remainingPortions)
    : item.remainingPortions
  const canIncrease = quantity < maximum

  return <article className="discount-food-card">
    <a className="discount-food-media" href={detailUrl} aria-label={`مشاهده جزئیات ${item.foodName}`}>
      <FoodImage src={item.imageUrl} alt={item.foodName} />
      <span className="discount-food-badge">
        <Icon name="discount" size="xs" /> {formatNumber(item.discountPercentage ?? 0)}٪ تخفیف
      </span>
    </a>
    <div className="discount-food-body">
      <h3 title={item.foodName}><a href={detailUrl}>{item.foodName}</a></h3>
      {offersRice && <label className="rice-upgrade-option">
        <input type="checkbox" checked={withPersianRice} disabled={!riceAvailable && !upgradedInCart}
          onChange={(event) => setWithPersianRice(event.target.checked)} />
        <span>{riceAvailable || upgradedInCart
          ? `با برنج ایرانی (+${formatMoney(persianRice.price)})`
          : 'برنج ایرانی امروز تمام شده است'}</span>
      </label>}
      {otherLine && <small className="cart-variant-hint">
        {formatNumber(otherLine.quantity)} پرس {otherLine.withPersianRice ? 'با برنج ایرانی' : 'بدون برنج ایرانی'} هم در سبد شماست
      </small>}
      <div className="discount-food-action">
        <div>
          <PriceDisplay
            price={item.price + (withPersianRice && persianRice ? persianRice.price : 0)}
            originalPrice={item.originalPrice}
            discountPercentage={item.discountPercentage}
            showDiscountPill={false}
          />
        </div>
        {quantity > 0
          ? <div className="quantity-add-control discount-quantity-control" aria-label={`${item.foodName} در سبد خرید`}>
              <button type="button" className="quantity-add-button"
                onClick={() => onQuantityChange(item.id, quantity - 1, withPersianRice)} aria-label={`کم کردن ${item.foodName}`}>
                <Icon name="minus" size="sm" />
              </button>
              <span className="quantity-add-status"><span>{formatNumber(quantity)}</span><small>در سبد</small></span>
              <button type="button" className="quantity-add-button" onClick={() => onAdd(item, withPersianRice)}
                disabled={!canIncrease} aria-label={`اضافه کردن ${item.foodName}`}>
                <Icon name="add" size="sm" />
              </button>
            </div>
          : <button type="button" className="primary-button discount-add-button" onClick={() => onAdd(item, withPersianRice)}>
              <Icon name="cart" size="sm" /><span>{withPersianRice ? 'افزودن با برنج ایرانی' : 'افزودن'}</span>
            </button>}
      </div>
    </div>
  </article>
}

export function DiscountShowcase({ items, persianRice, cartItems, onAdd, onQuantityChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)

  if (items.length === 0) return null

  const scroll = (direction: 'next' | 'previous') => {
    trackRef.current?.scrollBy({
      behavior: 'smooth',
      left: direction === 'next' ? -300 : 300,
    })
  }

  return <section className="discount-showcase" aria-labelledby="discount-showcase-title">
    <header className="discount-showcase-header">
      <div>
        <span className="discount-showcase-icon"><Icon name="discount" size="md" /></span>
        <div>
          <h2 id="discount-showcase-title">تخفیف‌های امروز</h2>
          <p>چند انتخاب خوش‌قیمت از سفره امروز</p>
        </div>
      </div>
      {items.length > 1 && <div className="discount-showcase-controls" aria-label="پیمایش تخفیف‌ها">
        <button type="button" onClick={() => scroll('next')} aria-label="تخفیف بعدی">
          <Icon name="back" size="sm" />
        </button>
        <button type="button" onClick={() => scroll('previous')} aria-label="تخفیف قبلی">
          <Icon name="forward" size="sm" />
        </button>
      </div>}
    </header>

    <div ref={trackRef} className="discount-showcase-track" tabIndex={0} aria-label="غذاهای تخفیف‌دار امروز">
      {items.map((item) => <DiscountCard key={item.id} item={item} persianRice={persianRice}
        cartItems={cartItems} onAdd={onAdd} onQuantityChange={onQuantityChange} />)}
    </div>
  </section>
}
