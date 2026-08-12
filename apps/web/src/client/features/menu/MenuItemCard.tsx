import { useState } from 'react'
import type { CartItem, DailyMenuItemDto, PersianRiceDto } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'
import { FoodImage } from '../../design-system/FoodImage'
import { Icon } from '../../design-system/Icon'
import { PriceDisplay } from '../../design-system/PriceDisplay'
import { RiceUpgradeDialog } from '../../design-system/RiceUpgradeDialog'

type Props = {
  item: DailyMenuItemDto
  persianRice: PersianRiceDto | null
  cartItems: CartItem[]
  onAdd: (item: DailyMenuItemDto, withPersianRice?: boolean) => void
  onQuantityChange: (id: number, quantity: number, withPersianRice?: boolean) => void
}

export function MenuItemCard({ item, persianRice, cartItems, onAdd, onQuantityChange }: Props) {
  // The checkbox chooses what the next add puts in the basket. The dish can sit in the basket both
  // ways at once, so the stepper follows the selected variant and the other one is named explicitly
  // — otherwise toggling the box looks like the basket just lost a portion.
  // Turning the upgrade on changes what every later add costs, so it is confirmed in a dialog that
  // spells the difference out. Turning it off is harmless and applies straight away.
  const [withPersianRice, setWithPersianRice] = useState(false)
  const [confirmingRice, setConfirmingRice] = useState(false)
  const lines = cartItems.filter((cartItem) => cartItem.dailyMenuItemId === item.id)
  const upgradedInCart = lines.some((cartItem) => cartItem.withPersianRice)
  const riceAvailable = Boolean(persianRice?.isAvailable && persianRice.remainingPortions > 0)
  const offersRice = item.allowsPersianRice && persianRice != null
  const quantity = lines.find((cartItem) => Boolean(cartItem.withPersianRice) === withPersianRice)?.quantity ?? 0
  const otherLine = lines.find((cartItem) => Boolean(cartItem.withPersianRice) !== withPersianRice)
  const isInCart = quantity > 0
  const maximum = withPersianRice && persianRice
    ? Math.min(item.remainingPortions, persianRice.remainingPortions)
    : item.remainingPortions
  const canIncrease = quantity < maximum

  return <article className="menu-card">
    <div className="card-media">
      <a href={`/foods/${item.slug}?menuItemId=${item.id}`} aria-label={`مشاهده جزئیات ${item.foodName}`}>
        <FoodImage src={item.imageUrl} alt={item.foodName} />
      </a>
      {item.primaryBadge && <span className="food-card-badge">
        {item.primaryBadge.icon && <span aria-hidden="true">{item.primaryBadge.icon}</span>}
        {item.primaryBadge.title}
      </span>}
      {item.discountPercentage && <span className="discount-card-badge">
        <Icon name="discount" size="xs" /> {formatNumber(item.discountPercentage)}٪ تخفیف
      </span>}
    </div>
    <div className="menu-card-body">
      <h3 title={item.foodName}><a href={`/foods/${item.slug}?menuItemId=${item.id}`}>{item.foodName}</a></h3>
      {item.foodDescription && <p className="menu-card-description" title={item.foodDescription}>{item.foodDescription}</p>}

      <div className="menu-card-meta" aria-label="اطلاعات غذا">
        <span><Icon name="freshIngredients" size="xs" /> پخت تازه امروز</span>
      </div>
      {/* Both answers add the dish right away — the dialog is the add action, not just a toggle — so
          the customer never has to check a box and then hunt for a separate add button. */}
      {confirmingRice && persianRice && <RiceUpgradeDialog
        foodName={item.foodName}
        basePrice={item.price}
        ricePrice={persianRice.price}
        riceTitle={persianRice.title}
        onConfirm={() => { setWithPersianRice(true); onAdd(item, true); setConfirmingRice(false) }}
        onCancel={() => { setWithPersianRice(false); onAdd(item, false); setConfirmingRice(false) }}
      />}
      <div className="menu-card-purchase">
        {offersRice && <label className="rice-upgrade-option rice-upgrade-option-card">
          <input type="checkbox" checked={withPersianRice} disabled={!riceAvailable && !upgradedInCart}
            onChange={(event) => event.target.checked ? setConfirmingRice(true) : setWithPersianRice(false)} />
          <span className="rice-upgrade-label">{riceAvailable || upgradedInCart
            ? 'با برنج ایرانی'
            : 'برنج ایرانی امروز تمام شده است'}</span>
          {(riceAvailable || upgradedInCart) && <span className="rice-upgrade-price">+{formatMoney(persianRice.price)}</span>}
        </label>}
        {otherLine && <small className="cart-variant-hint">
          {formatNumber(otherLine.quantity)} پرس {otherLine.withPersianRice ? 'با برنج ایرانی' : 'بدون برنج ایرانی'} هم در سبد شماست
        </small>}

        <div className="menu-card-action">
          <div>
            <PriceDisplay
              price={item.price + (withPersianRice && persianRice ? persianRice.price : 0)}
              originalPrice={item.originalPrice}
              discountPercentage={item.discountPercentage}
              showDiscountPill={false}
            />
          </div>
          {isInCart
            ? <div className="add-button quantity-add-control" aria-label={`${item.foodName} در سبد خرید`}>
                <button
                  type="button"
                  className="quantity-add-button"
                  onClick={() => onQuantityChange(item.id, quantity - 1, withPersianRice)}
                  aria-label={`کم کردن ${item.foodName}`}
                >
                  <Icon name="minus" size="sm" />
                </button>
                <span className="quantity-add-status">
                  <span>{formatNumber(quantity)}</span>
                  <small>در سبد خرید</small>
                </span>
                <button
                  type="button"
                  className="quantity-add-button"
                  onClick={() => onAdd(item, withPersianRice)}
                  disabled={!canIncrease}
                  aria-label={`اضافه کردن ${item.foodName}`}
                >
                  <Icon name="add" size="sm" />
                </button>
              </div>
            : <button className="primary-button add-button" onClick={() => onAdd(item, withPersianRice)}>
                <Icon name="cart" size="sm" />
                <span>{withPersianRice ? 'افزودن با برنج ایرانی' : 'افزودن به سبد خرید'}</span>
              </button>}
        </div>
      </div>
    </div>
  </article>
}
