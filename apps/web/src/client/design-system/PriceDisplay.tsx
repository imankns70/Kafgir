import { formatMoney, formatNumber } from '../utils/format'
import { Icon } from './Icon'

type Props = {
  price: number | null
  originalPrice?: number | null
  discountPercentage?: number | null
  label?: string
  compact?: boolean
  showDiscountPill?: boolean
}

export function PriceDisplay({
  price,
  originalPrice = null,
  discountPercentage = null,
  label = '',
  compact = false,
  showDiscountPill = true,
}: Props) {
  const hasDiscount = price !== null && originalPrice !== null && originalPrice > price

  return <div className={`price-display${hasDiscount ? ' has-discount' : ''}${compact ? ' compact' : ''}`}>
    {label && <span className="price-label">{label}</span>}
    {hasDiscount && <div className="price-discount-meta">
      <del>{formatMoney(originalPrice)}</del>
      {showDiscountPill && <span className="discount-pill"><Icon name="discount" size="xs" /> {formatNumber(discountPercentage ?? Math.round((1 - price / originalPrice) * 100))}٪</span>}
    </div>}
    <strong className="price">{price !== null ? formatMoney(price) : '—'}</strong>
  </div>
}
