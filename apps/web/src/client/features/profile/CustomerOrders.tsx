import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { buildInvoiceOrderLines, PaymentStatus } from '@kafgir/contracts'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import {
  OrderStatus,
  PaymentMethod,
  type CustomerOrderDetailDto,
  type CustomerOrderSummaryDto,
  type CustomerOrdersPageDto,
  type OrderReviewDto,
} from '../../types'
import { formatMoney, formatNumber, formatPersianDateTime } from '../../utils/format'

const statusSteps = [
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.Delivered,
] as const

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'ثبت و در انتظار تأیید',
  [OrderStatus.Confirmed]: 'تأیید سفارش',
  [OrderStatus.Preparing]: 'در حال آماده‌سازی',
  [OrderStatus.Ready]: 'آماده تحویل',
  [OrderStatus.Delivered]: 'تحویل شده',
  [OrderStatus.Cancelled]: 'لغو شده',
}

const paymentMethodLabel: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: 'نقدی',
  [PaymentMethod.CardToCard]: 'کارت‌به‌کارت',
  [PaymentMethod.Online]: 'پرداخت آنلاین',
  [PaymentMethod.Pos]: 'کارت‌خوان',
}

const paymentStatusLabel: Record<PaymentStatus, string> = {
  [PaymentStatus.Pending]: 'در انتظار پرداخت',
  [PaymentStatus.AwaitingVerification]: 'در انتظار تأیید',
  [PaymentStatus.Paid]: 'موفق',
  [PaymentStatus.Failed]: 'ناموفق',
  [PaymentStatus.Rejected]: 'رد شده',
  [PaymentStatus.Cancelled]: 'لغو شده',
  [PaymentStatus.Refunded]: 'مسترد شده',
}

const finalStatuses = new Set<OrderStatus>([OrderStatus.Delivered, OrderStatus.Cancelled])
const persianRiceSuffix = ' (با برنج ایرانی)'

export const isActiveOrder = (order: Pick<CustomerOrderSummaryDto, 'status'>) => !finalStatuses.has(order.status)
export const awaitsReview = (order: Pick<CustomerOrderSummaryDto, 'status' | 'review'>) =>
  order.status === OrderStatus.Delivered && order.review == null

type TimelineData = Pick<CustomerOrderSummaryDto, 'status' | 'createdAt' | 'statusHistories'>

export function OrderProgress({ order, compact = false }: { order: TimelineData; compact?: boolean }) {
  const occurred = new Map<OrderStatus, string>()
  occurred.set(OrderStatus.PendingConfirmation, order.createdAt)
  for (const history of order.statusHistories) occurred.set(history.toStatus, history.changedAt)
  const steps: OrderStatus[] = order.status === OrderStatus.Cancelled
    ? [...statusSteps.filter((status) => occurred.has(status) && status !== OrderStatus.Delivered), OrderStatus.Cancelled]
    : [...statusSteps]

  return <ol className={`customer-progress ${compact ? 'compact' : ''}`} aria-label="روند وضعیت سفارش">
    {steps.map((status) => {
      const timestamp = occurred.get(status)
      // A delivered order has arrived: its last step is an accomplishment, not a step in progress,
      // so it takes the same tick as the ones before it rather than the "you are here" marker.
      const isDelivered = order.status === OrderStatus.Delivered
      const isCurrent = status === order.status && !isDelivered
      const isCompleted = (timestamp != null || isDelivered) && !isCurrent
      const isUpcoming = timestamp == null && !isCurrent
      return <li className={`${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${status === OrderStatus.Cancelled ? 'cancelled' : ''}`} key={status}>
        <span className="progress-marker" aria-hidden="true">
          {status === OrderStatus.Cancelled ? <Icon name="cancel" size="xs" /> : isCompleted ? <Icon name="confirm" size="xs" /> : null}
        </span>
        <span className="progress-copy"><strong>{statusLabel[status]}</strong>
          {!compact && timestamp && <time>{formatPersianDateTime(timestamp)}</time>}
          {!compact && !timestamp && order.status === OrderStatus.Delivered && <small>در تاریخچه ثبت نشده</small>}
        </span>
      </li>
    })}
  </ol>
}

export function ReviewStars({ value, size = 'sm' }: { value: number; size?: 'xs' | 'sm' | 'md' }) {
  return <span className="review-stars" role="img" aria-label={`${formatNumber(value)} از ۵ ستاره`}>
    {[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="rating" size={size} className={star <= value ? 'selected' : ''} />)}
  </span>
}

function PaymentState({ status }: { status: PaymentStatus | null }) {
  if (status == null) return <span className="payment-state neutral">تراکنشی ثبت نشده</span>
  const tone = status === PaymentStatus.Paid ? 'success'
    : [PaymentStatus.Failed, PaymentStatus.Rejected, PaymentStatus.Cancelled].includes(status) ? 'error'
      : status === PaymentStatus.Refunded ? 'warning' : 'pending'
  return <span className={`payment-state ${tone}`}>{paymentStatusLabel[status]}</span>
}

/** The order's dishes as customer-facing lines, with the Persian-rice add-on folded into its dish. */
function OrderLines({ items, fallback }: { items: CustomerOrderSummaryDto['foodItems']; fallback: string }) {
  const lines = buildInvoiceOrderLines(items ?? [])
  if (lines.length === 0) return <p className="order-card-foods">{fallback || 'سفارش ثبت‌شده'}</p>
  return <ul className="order-card-foods">
    {lines.map((line) => <li key={line.key}>
      <span className="order-card-qty">{formatNumber(line.quantity)}×</span>
      <span>{line.foodName.replace(persianRiceSuffix, '')}</span>
      {line.key.includes(':rice:') && <small>با برنج ایرانی</small>}
    </li>)}
  </ul>
}

function OrderCard({ order, opening, disabled, onOpen, onReview }: {
  order: CustomerOrderSummaryDto
  opening: boolean
  disabled: boolean
  onOpen: () => void
  onReview: () => void
}) {
  const active = isActiveOrder(order)
  // Only a payment that still needs attention earns a chip; cash orders have no transaction at all.
  const showPayment = order.paymentStatus != null && order.paymentStatus !== PaymentStatus.Paid && order.status !== OrderStatus.Cancelled
  return <article className={`customer-order-card ${active ? 'active-order' : 'history-order'}${order.status === OrderStatus.Cancelled ? ' cancelled-order' : ''}`}>
    <header className="order-card-header">
      <div className="order-card-id">
        <strong className="order-number" dir="ltr">#{order.orderNumber}</strong>
        <time>{formatPersianDateTime(order.createdAt)}</time>
      </div>
      <StatusBadge status={order.status} />
    </header>
    {active && <OrderProgress order={order} compact />}
    <OrderLines items={order.foodItems} fallback={order.foodSummary} />
    <p className="order-card-address"><Icon name="location" size="xs" /><span>{order.deliveryCity}، {order.addressLine}</span></p>
    <footer className="order-card-footer">
      <div className="order-card-total">
        <span>جمع فاکتور</span>
        <strong>{formatMoney(order.totalAmount)}</strong>
        {showPayment && <PaymentState status={order.paymentStatus} />}
      </div>
      <button type="button" className="order-card-open" disabled={disabled} onClick={onOpen}>
        {opening ? 'در حال باز کردن…' : <>جزئیات <Icon name="forward" size="sm" /></>}
      </button>
    </footer>
    {order.status === OrderStatus.Delivered && (order.review
      ? <button type="button" className="order-card-review is-done" onClick={onReview} aria-label="ویرایش امتیاز و نظر">
          <span>امتیاز شما</span><ReviewStars value={order.review.rating} size="xs" /><Icon name="edit" size="xs" />
        </button>
      : <button type="button" className="order-card-review" onClick={onReview}>
          <Icon name="rating" size="sm" /><span>این سفارش چطور بود؟ امتیاز بدهید</span>
        </button>)}
  </article>
}

export function CustomerOrdersList({ orders, onOpen, onReview, onPage, onBrowse, error, onRetry, openingOrderId }: {
  orders: CustomerOrdersPageDto | null
  onOpen: (id: number) => void
  onReview: (order: CustomerOrderSummaryDto) => void
  onPage: (page: number) => void
  onBrowse: () => void
  error?: string | null
  onRetry?: () => void
  /** Order whose details are being fetched, so its button can report the wait. */
  openingOrderId?: number | null
}) {
  if (error && !orders) return <div className="account-empty is-error" role="alert">
    <span className="account-empty-icon"><Icon name="info" size="xl" /></span>
    <h3>دریافت سفارش‌ها ممکن نشد.</h3>
    <p>{error}</p>
    {onRetry && <button className="outline-button" onClick={onRetry}>تلاش دوباره</button>}
  </div>
  if (!orders) return <div className="customer-orders-skeleton" aria-label="در حال دریافت سفارش‌ها">
    {[1, 2].map((item) => <span key={item} />)}
  </div>
  if (orders.items.length === 0) return <div className="account-empty">
    <span className="account-empty-icon"><Icon name="orders" size="xl" /></span>
    <h3>هنوز سفارشی ثبت نکرده‌اید.</h3>
    <p>منوی تازه امروز را ببینید و اولین سفارش کفگیرتان را ثبت کنید.</p>
    <button className="primary-button" onClick={onBrowse}>مشاهده منوی امروز</button>
  </div>

  const active = orders.items.filter(isActiveOrder)
  const history = orders.items.filter((order) => !isActiveOrder(order))
  const renderCard = (order: CustomerOrderSummaryDto) => <OrderCard key={order.id} order={order}
    opening={openingOrderId === order.id} disabled={openingOrderId != null}
    onOpen={() => onOpen(order.id)} onReview={() => onReview(order)} />

  return <>
    {/* A failure that arrives after the list has loaded — opening one order, most often — used to be
        swallowed, because the error block above only renders when the list itself is missing. */}
    {error && <div className="customer-orders-inline-error" role="alert">
      <Icon name="info" size="sm" />
      <span>{error}</span>
      {onRetry && <button type="button" className="outline-button" onClick={onRetry}>تلاش دوباره</button>}
    </div>}
    {active.length > 0 && <section className="order-group" aria-label="سفارش‌های در جریان">
      <h3 className="order-group-title"><span className="live-dot" aria-hidden="true" /> در جریان</h3>
      <div className="customer-order-list">{active.map(renderCard)}</div>
    </section>}
    {history.length > 0 && <section className="order-group" aria-label="سفارش‌های قبلی">
      {active.length > 0 && <h3 className="order-group-title">سفارش‌های قبلی</h3>}
      <div className="customer-order-list">{history.map(renderCard)}</div>
    </section>}
    {orders.totalPages > 1 && <nav className="pagination-actions" aria-label="صفحه‌بندی سفارش‌ها">
      <button className="outline-button" disabled={orders.page <= 1} onClick={() => onPage(orders.page - 1)}>قبلی</button>
      <span>صفحه {formatNumber(orders.page)} از {formatNumber(orders.totalPages)}</span>
      <button className="outline-button" disabled={orders.page >= orders.totalPages} onClick={() => onPage(orders.page + 1)}>بعدی</button>
    </nav>}
  </>
}

export function CustomerOrderDetails({ order, onBack, onReview }: {
  order: CustomerOrderDetailDto
  onBack: () => void
  onReview: () => void
}) {
  const lines = buildInvoiceOrderLines(order.items)
  const discountAmount = order.items.reduce((sum, item) => (
    sum + Math.max(0, (item.originalUnitPrice ?? item.unitPrice) - item.unitPrice) * item.quantity
  ), 0)
  return <div className="customer-order-detail">
    <button type="button" className="account-back" onClick={onBack}><Icon name="back" size="sm" /> سفارش‌های من</button>

    <section className="account-card order-detail-hero">
      <div className="order-detail-hero-head">
        <div>
          <span className="order-detail-kicker">شماره سفارش</span>
          <strong className="order-detail-number" dir="ltr">#{order.orderNumber}</strong>
          <time>{formatPersianDateTime(order.createdAt)}</time>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <OrderProgress order={order} />
    </section>

    {order.status === OrderStatus.Delivered && <section className={`account-card detail-review-panel${order.review ? ' is-done' : ''}`}>
      <span className="detail-review-icon" aria-hidden="true"><Icon name="rating" size="md" /></span>
      <div>
        <h2>{order.review ? 'نظر شما درباره این سفارش' : 'این سفارش چطور بود؟'}</h2>
        {order.review
          ? <>{<ReviewStars value={order.review.rating} />}{order.review.comment && <p>«{order.review.comment}»</p>}</>
          : <p>با یک امتیاز کوتاه به بهتر شدن غذای کفگیر کمک کنید.</p>}
      </div>
      <button className={order.review ? 'outline-button' : 'primary-button'} onClick={onReview}>
        {order.review ? <><Icon name="edit" size="sm" /> ویرایش</> : <><Icon name="rating" size="sm" /> ثبت امتیاز</>}
      </button>
    </section>}

    <div className="customer-order-detail-grid">
      <section className="account-card order-detail-items">
        <h2 className="account-card-title"><Icon name="food" size="sm" /> اقلام سفارش</h2>
        <ul className="order-detail-lines">
          {lines.map((line) => {
            const source = order.items.find((item) => line.key.startsWith(`${item.id}:`))
            const original = source?.originalUnitPrice != null && source.originalUnitPrice > source.unitPrice ? source.originalUnitPrice : null
            return <li key={line.key}>
              <span className="order-detail-qty">{formatNumber(line.quantity)}×</span>
              <div>
                <strong>{line.foodName.replace(persianRiceSuffix, '')}</strong>
                {line.key.includes(':rice:') && <small className="order-detail-addon">با برنج ایرانی</small>}
                <span>هر پرس {formatMoney(line.unitPrice)}{original != null && <del>{formatMoney(original)}</del>}</span>
              </div>
              <strong className="order-detail-line-total">{formatMoney(line.totalPrice)}</strong>
            </li>
          })}
        </ul>
        <dl className="financial-breakdown">
          {discountAmount > 0 && <div><dt>تخفیف شما</dt><dd className="discount-value">− {formatMoney(discountAmount)}</dd></div>}
          <div><dt>جمع اقلام</dt><dd>{formatMoney(order.subtotalAmount)}</dd></div>
          {/* Always shown, even at zero: an explicit ۰ تومان reads as free delivery. The value is the
              order's own snapshot, so a later price change never rewrites this receipt. */}
          <div><dt>هزینه ارسال</dt><dd>{order.deliveryFee > 0 ? formatMoney(order.deliveryFee) : 'رایگان'}</dd></div>
          <div className="grand-total"><dt>جمع فاکتور</dt><dd>{formatMoney(order.totalAmount)}</dd></div>
        </dl>
      </section>

      <div className="order-detail-side">
        <section className="account-card order-delivery-panel">
          <h2 className="account-card-title"><Icon name="delivery" size="sm" /> تحویل</h2>
          <dl className="order-detail-list">
            <div><dt>تحویل‌گیرنده</dt><dd>{order.customerFullName}</dd></div>
            <div><dt>شماره تماس</dt><dd><bdi dir="ltr">{order.customerPhoneNumber}</bdi></dd></div>
            <div><dt>نشانی</dt><dd>{order.deliveryCity}، {order.addressLine}</dd></div>
            {order.deliveryTimeSlotTitle && <div><dt>زمان تحویل</dt><dd>{order.deliveryTimeSlotTitle}{order.deliveryStartTime && order.deliveryEndTime ? ` · ${order.deliveryStartTime} تا ${order.deliveryEndTime}` : ''}</dd></div>}
            {order.customerNote && <div><dt>توضیح شما</dt><dd>{order.customerNote}</dd></div>}
          </dl>
        </section>

        <section className="account-card order-payment-panel">
          <h2 className="account-card-title"><Icon name="discount" size="sm" /> پرداخت</h2>
          {order.payments.length === 0
            ? <div className="payment-empty"><strong>{paymentMethodLabel[order.paymentMethod]}</strong><p>{order.paymentMethod === PaymentMethod.Cash || order.paymentMethod === PaymentMethod.Pos ? 'پرداخت هنگام تحویل انجام می‌شود.' : 'هنوز تراکنشی برای این سفارش ثبت نشده است.'}</p></div>
            : <div className="customer-payment-list">{order.payments.map((payment, index) => <article key={`${payment.createdAt}-${index}`}>
                <header><strong>{paymentMethodLabel[payment.paymentMethod]}</strong><PaymentState status={payment.status} /></header>
                <dl className="order-detail-list">
                  <div><dt>مبلغ</dt><dd>{formatMoney(payment.amount)}</dd></div>
                  <div><dt>زمان ثبت</dt><dd>{formatPersianDateTime(payment.paidAt ?? payment.createdAt)}</dd></div>
                  {payment.providerName && <div><dt>ارائه‌دهنده</dt><dd>{payment.providerName}</dd></div>}
                  {payment.paymentMethod !== PaymentMethod.Cash && payment.trackingNumber && <div><dt>شماره پیگیری</dt><dd><bdi dir="ltr">{payment.trackingNumber}</bdi></dd></div>}
                  {payment.paymentMethod !== PaymentMethod.Cash && payment.referenceNumber && <div><dt>شماره مرجع</dt><dd><bdi dir="ltr">{payment.referenceNumber}</bdi></dd></div>}
                </dl>
              </article>)}</div>}
        </section>
      </div>
    </div>
  </div>
}

/** Shown as the customer picks a star, so the number has a meaning before they commit to it. */
const ratingLabels: Record<number, string> = {
  1: 'خیلی بد بود', 2: 'بد بود', 3: 'معمولی بود', 4: 'خوب بود', 5: 'عالی بود!',
}

// One tap turns a common remark into text, so a quick review still says something specific.
const positiveRemarks = ['خوش‌طعم بود', 'گرم رسید', 'به‌موقع رسید', 'حجم غذا مناسب بود', 'بسته‌بندی تمیز بود']
const negativeRemarks = ['سرد رسید', 'دیر رسید', 'طعم مناسب نبود', 'حجم غذا کم بود', 'بسته‌بندی آسیب دیده بود']

export function OrderReviewDialog({
  orderNumber, review, busy, error, onClose, onSave, title, intro, onLater,
}: {
  orderNumber: string
  review: OrderReviewDto | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (rating: number, comment: string) => void
  /** The post-delivery prompt asks a warmer question than the order-history entry point. */
  title?: string
  intro?: string
  /** Renders «بعداً». Only the automatic prompt offers it; the order-history dialog does not. */
  onLater?: () => void
}) {
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => { dialogRef.current?.focus() }, [])
  const onStarKey = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
    let next = star
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.min(5, star + 1)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.max(1, star - 1)
    else if (event.key === 'Home') next = 1
    else if (event.key === 'End') next = 5
    else return
    event.preventDefault()
    setRating(next)
    dialogRef.current?.querySelector<HTMLButtonElement>(`[data-rating="${next}"]`)?.focus()
  }
  const remarks = rating === 0 ? [] : rating >= 4 ? positiveRemarks : negativeRemarks
  const toggleRemark = (remark: string) => setComment((current) => {
    if (current.includes(remark)) return current.replace(remark, '').replace(/[،,]\s*[،,]/gu, '،').replace(/^[\s،,]+|[\s،,]+$/gu, '')
    return current.trim() ? `${current.trim()}، ${remark}` : remark
  })

  return <div ref={dialogRef} tabIndex={-1} className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"
    onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <div className="review-dialog-card">
      <span className="review-dialog-grabber" aria-hidden="true" />
      <button type="button" className="review-dialog-close" aria-label="بستن" onClick={onClose}><Icon name="cancel" size="md" /></button>
      <header className="review-dialog-head">
        <span className="review-dialog-icon" aria-hidden="true"><Icon name="rating" size="lg" /></span>
        <h2 id="review-title">{title ?? (review ? 'ویرایش امتیاز و نظر' : 'این سفارش چطور بود؟')}</h2>
        <p>{intro ?? 'امتیاز شما مستقیم به آشپزخانه کفگیر می‌رسد.'}</p>
        <span className="review-dialog-order">سفارش <bdi dir="ltr">#{orderNumber}</bdi></span>
      </header>

      <fieldset className="star-rating">
        <legend>امتیاز شما</legend>
        <div role="radiogroup" aria-label="امتیاز از یک تا پنج ستاره">
          {[1, 2, 3, 4, 5].map((star) => <button type="button" role="radio" aria-checked={rating === star}
            aria-label={`${formatNumber(star)} ستاره`} data-rating={star}
            tabIndex={rating === star || (rating === 0 && star === 1) ? 0 : -1}
            className={star <= rating ? 'selected' : ''} key={star}
            onClick={() => setRating(star)} onKeyDown={(event) => onStarKey(event, star)}>
            <Icon name="rating" size="xl" />
          </button>)}
        </div>
        <p className="star-rating-label" aria-live="polite">{rating > 0 ? ratingLabels[rating] : 'روی ستاره‌ها بزنید'}</p>
      </fieldset>

      {remarks.length > 0 && <div className="review-remarks" role="group" aria-label="نکته‌های آماده">
        {remarks.map((remark) => <button type="button" key={remark} aria-pressed={comment.includes(remark)}
          className={comment.includes(remark) ? 'active' : ''} onClick={() => toggleRemark(remark)}>{remark}</button>)}
      </div>}

      <label className="review-comment">
        <span>توضیح بیشتر <small>اختیاری</small></span>
        <textarea maxLength={1000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="هر چیزی که دوست دارید آشپزخانه بداند…" />
        <small className="review-comment-count">{formatNumber(comment.length)} / ۱۰۰۰</small>
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="review-dialog-actions">
        <button className="primary-button" disabled={busy || rating === 0} onClick={() => onSave(rating, comment)}>
          {busy ? 'در حال ثبت…' : review ? 'ذخیره تغییرات' : 'ثبت امتیاز'}
        </button>
        {onLater && <button className="review-later" disabled={busy} onClick={onLater}>بعداً</button>}
      </div>
    </div>
  </div>
}
