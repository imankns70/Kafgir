import { formatNumber } from '../../utils/format'

const checkoutStepCount = 4

/** «مرحله ۲ از ۴» above a step's title: the phone wizard's only sense of where the customer is. */
export function CheckoutStepCaption({ index }: { index: number }) {
  return <span className="checkout-step-caption checkout-mobile-only">مرحله {formatNumber(index + 1)} از {formatNumber(checkoutStepCount)}</span>
}
