import type { DailyMenuItemDto } from '../../types'
import { formatMoney, toPersianDigits } from '../../utils/format'
import { FoodImage } from '../../design-system/FoodImage'
import { Icon } from '../../design-system/Icon'

type Props = {
  item: DailyMenuItemDto
  quantity: number
  onAdd: (item: DailyMenuItemDto) => void
  onQuantityChange: (id: number, quantity: number) => void
}

export function MenuItemCard({ item, quantity, onAdd, onQuantityChange }: Props) {
  const isInCart = quantity > 0
  const canIncrease = quantity < item.remainingPortions

  return <article className="menu-card">
    <div className="card-media">
      <FoodImage src={item.imageUrl} alt={item.foodName} />
    </div>
    <div className="menu-card-body">
      <h3 title={item.foodName}>{item.foodName}</h3>
      {item.foodDescription && <p className="menu-card-description" title={item.foodDescription}>{item.foodDescription}</p>}

      <div className="menu-card-meta" aria-label="اطلاعات غذا">
        <span><Icon name="freshIngredients" size="xs" /> پخت تازه امروز</span>
        <span><Icon name="packaging" size="xs" /> {toPersianDigits(item.remainingPortions)} پرس موجود</span>
      </div>

      <div className="menu-card-action">
        <div className="menu-card-price">
          <span>قیمت هر پرس</span>
          <strong className="price">{formatMoney(item.price)}</strong>
        </div>
        {isInCart
          ? <div className="add-button quantity-add-control" aria-label={`${item.foodName} در سبد خرید`}>
              <button
                type="button"
                className="quantity-add-button"
                onClick={() => onQuantityChange(item.id, quantity - 1)}
                aria-label={`کم کردن ${item.foodName}`}
              >
                <Icon name="minus" size="sm" />
              </button>
              <span className="quantity-add-status">
                <span>{toPersianDigits(quantity)}</span>
                <small>در سبد خرید</small>
              </span>
              <button
                type="button"
                className="quantity-add-button"
                onClick={() => onAdd(item)}
                disabled={!canIncrease}
                aria-label={`اضافه کردن ${item.foodName}`}
              >
                <Icon name="add" size="sm" />
              </button>
            </div>
          : <button className="primary-button add-button" onClick={() => onAdd(item)}>
              <Icon name="cart" size="sm" /><span>افزودن به سبد خرید</span>
            </button>}
      </div>
    </div>
  </article>
}
