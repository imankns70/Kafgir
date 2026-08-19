import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PaymentStatus } from '@kafgir/contracts'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import {
  DeliveryMethod,
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
      const timestamp = status === OrderStatus.Cancelled
        ? occurred.get(status)
        : occurred.get(status)
      const isCurrent = status === order.status
      const isCompleted = timestamp != null && !isCurrent
      const isUpcoming = timestamp == null && !isCurrent
      return <li className={`${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isUpcoming ? 'upcoming' : ''} ${status === OrderStatus.Cancelled ? 'cancelled' : ''}`} key={status}>
        <span className="progress-marker" aria-hidden="true">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
        <span className="progress-copy"><strong>{statusLabel[status]}</strong>
          {!compact && timestamp && <time>{formatPersianDateTime(timestamp)}</time>}
          {!compact && !timestamp && order.status === OrderStatus.Delivered && <small>در تاریخچه ثبت نشده</small>}
        </span>
      </li>
    })}
  </ol>
}

function ReviewStars({ value }: { value: number }) {
  return <span className="review-stars" aria-label={`${formatNumber(value)} از ۵ ستاره`}>
    {[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="rating" size="sm" className={star <= value ? 'selected' : ''} />)}
  </span>
}

function PaymentState({ status }: { status: PaymentStatus | null }) {
  if (status == null) return <span className="payment-state neutral">تراکنشی ثبت نشده</span>
  const tone = status === PaymentStatus.Paid ? 'success'
    : [PaymentStatus.Failed, PaymentStatus.Rejected, PaymentStatus.Cancelled].includes(status) ? 'error'
      : status === PaymentStatus.Refunded ? 'warning' : 'pending'
  return <span className={`payment-state ${tone}`}>{paymentStatusLabel[status]}</span>
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
  if (error && !orders) return <div className="customer-orders-error" role="alert">
    <span className="empty-icon"><Icon name="info" size="xl" /></span>
    <h3>دریافت سفارش‌ها ممکن نشد.</h3>
    <p>{error}</p>
    {onRetry && <button className="outline-button" onClick={onRetry}>تلاش دوباره</button>}
  </div>
  if (!orders) return <div className="customer-orders-skeleton" aria-label="در حال دریافت سفارش‌ها">
    {[1, 2].map((item) => <span key={item} />)}
  </div>
  if (orders.items.length === 0) return <div className="customer-orders-empty">
    <span className="empty-icon"><Icon name="orders" size="xl" /></span>
    <h3>هنوز سفارشی ثبت نکرده‌اید.</h3>
    <p>منوی تازه امروز را ببینید و اولین سفارش کفگیرتان را ثبت کنید.</p>
    <button className="primary-button" onClick={onBrowse}>مشاهده منوی امروز</button>
  </div>

  return <>
    <div className="customer-order-list">
      {orders.items.map((order) => {
        const active = !finalStatuses.has(order.status)
        return <article className={`customer-order-card ${active ? 'active-order' : 'history-order'}`} key={order.id}>
          <header className="order-card-header">
            <div><span className="order-kicker">شماره سفارش</span><strong className="order-number" dir="ltr">#{formatNumber(order.orderNumber)}</strong></div>
            <StatusBadge status={order.status} />
          </header>
          <div className="order-card-date"><Icon name="clock" size="xs" /><time>{formatPersianDateTime(order.createdAt)}</time></div>
          {active && <OrderProgress order={order} compact />}
          <div className="order-card-foods">{order.foodSummary}</div>
          <div className="order-card-address"><Icon name="location" size="sm" /><div><span>نشانی تحویل</span><p>{order.deliveryCity}، {order.addressLine}</p></div></div>
          <div className="order-card-finance">
            <div><span>وضعیت پرداخت</span><PaymentState status={order.paymentStatus} /></div>
            <div><span>جمع فاکتور</span><strong>{formatMoney(order.totalAmount)}</strong></div>
          </div>
          {order.review && <div className="order-review-summary"><span>امتیاز شما</span><ReviewStars value={order.review.rating} />{order.review.comment && <p>{order.review.comment}</p>}</div>}
          <footer className="order-card-actions">
            <button className="outline-button order-detail-button" disabled={openingOrderId != null} onClick={() => onOpen(order.id)}>{openingOrderId === order.id ? 'در حال باز کردن…' : <>جزئیات سفارش <Icon name="forward" size="sm" /></>}</button>
            {order.status === OrderStatus.Delivered && <button className="primary-button review-action" onClick={() => onReview(order)}><Icon name="rating" size="sm" />{order.review ? 'ویرایش امتیاز و نظر' : 'ثبت امتیاز و نظر'}</button>}
          </footer>
        </article>
      })}
    </div>
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
  const discountAmount = order.items.reduce((sum, item) => (
    sum + Math.max(0, (item.originalUnitPrice ?? item.unitPrice) - item.unitPrice) * item.quantity
  ), 0)
  return <main className="customer-order-detail">
    <div className="page-actions">
      <div><p className="eyebrow">شماره سفارش <bdi>#{formatNumber(order.orderNumber)}</bdi></p><h1 className="section-title">جزئیات سفارش</h1></div>
      <button className="checkout-back-link" onClick={onBack}>سفارش‌های من <Icon name="back" size="sm" /></button>
    </div>
    <section className="panel order-detail-hero">
      <div className="order-detail-hero-head">
        <div className="order-detail-current-state"><span>وضعیت فعلی</span><StatusBadge status={order.status} /></div>
        <time>{formatPersianDateTime(order.createdAt)}</time>
      </div>
      <OrderProgress order={order} />
    </section>
    <div className="customer-order-detail-grid">
      <section className="panel order-detail-items">
        <h2 className="section-title">اقلام سفارش</h2>
        {order.items.map((item) => <div className="customer-order-line" key={item.id}>
          <div><strong>{item.foodName}</strong><span>{formatNumber(item.quantity)} پرس × {formatMoney(item.unitPrice)}</span>{item.originalUnitPrice != null && item.originalUnitPrice > item.unitPrice && <small>قیمت پیش از تخفیف: {formatMoney(item.originalUnitPrice)}</small>}</div>
          <strong>{formatMoney(item.totalPrice)}</strong>
        </div>)}
      </section>
      <section className="panel order-delivery-panel">
        <h2 className="section-title">اطلاعات تحویل</h2>
        <dl className="order-detail-list"><div><dt>تحویل‌گیرنده</dt><dd>{order.customerFullName}</dd></div><div><dt>شماره تماس</dt><dd><bdi dir="ltr">{order.customerPhoneNumber}</bdi></dd></div><div><dt>نشانی سفارش</dt><dd>{order.deliveryCity}، {order.addressLine}</dd></div>
          {order.deliveryTimeSlotTitle && <div><dt>زمان تحویل</dt><dd>{order.deliveryTimeSlotTitle}{order.deliveryStartTime && order.deliveryEndTime ? `؛ ${order.deliveryStartTime} تا ${order.deliveryEndTime}` : ''}</dd></div>}
          {order.customerNote && <div><dt>توضیح مشتری</dt><dd>{order.customerNote}</dd></div>}
        </dl>
      </section>
      <section className="panel order-financial-panel">
        <h2 className="section-title">خلاصه مالی</h2>
        <dl className="financial-breakdown">{discountAmount > 0 && <div><dt>تخفیف ثبت‌شده</dt><dd className="discount-value">− {formatMoney(discountAmount)}</dd></div>}<div><dt>جمع اقلام پس از تخفیف</dt><dd>{formatMoney(order.subtotalAmount)}</dd></div>{order.deliveryFee > 0 && <div><dt>هزینه ارسال</dt><dd>{formatMoney(order.deliveryFee)}</dd></div>}<div className="grand-total"><dt>جمع فاکتور</dt><dd>{formatMoney(order.totalAmount)}</dd></div></dl>
      </section>
      <section className="panel order-payment-panel">
        <h2 className="section-title">اطلاعات پرداخت</h2>
        {order.payments.length === 0 ? <div className="payment-empty"><strong>{paymentMethodLabel[order.paymentMethod]}</strong><p>{order.paymentMethod === PaymentMethod.Cash || order.paymentMethod === PaymentMethod.Pos ? 'پرداخت هنگام تحویل انجام می‌شود.' : 'هنوز تراکنشی برای این سفارش ثبت نشده است.'}</p></div>
          : <div className="customer-payment-list">{order.payments.map((payment, index) => <article key={`${payment.createdAt}-${index}`}>
            <header><strong>{paymentMethodLabel[payment.paymentMethod]}</strong><PaymentState status={payment.status} /></header>
            <dl className="order-detail-list"><div><dt>مبلغ</dt><dd>{formatMoney(payment.amount)}</dd></div><div><dt>زمان ثبت</dt><dd>{formatPersianDateTime(payment.paidAt ?? payment.createdAt)}</dd></div>{payment.providerName && <div><dt>ارائه‌دهنده</dt><dd>{payment.providerName}</dd></div>}{payment.paymentMethod !== PaymentMethod.Cash && payment.trackingNumber && <div><dt>شماره پیگیری</dt><dd><bdi dir="ltr">{payment.trackingNumber}</bdi></dd></div>}{payment.paymentMethod !== PaymentMethod.Cash && payment.referenceNumber && <div><dt>شماره مرجع</dt><dd><bdi dir="ltr">{payment.referenceNumber}</bdi></dd></div>}</dl>
          </article>)}</div>}
      </section>
    </div>
    {order.status === OrderStatus.Delivered && <section className="panel detail-review-panel">
      <div><h2 className="section-title">تجربه شما از این سفارش</h2>{order.review ? <><ReviewStars value={order.review.rating} />{order.review.comment && <p>{order.review.comment}</p>}</> : <p>نظر شما به بهترشدن تجربه کفگیر کمک می‌کند.</p>}</div>
      <button className="primary-button" onClick={onReview}><Icon name="rating" size="sm" />{order.review ? 'ویرایش نظر' : 'ثبت امتیاز و نظر'}</button>
    </section>}
  </main>
}

export function OrderReviewDialog({ orderNumber, review, busy, error, onClose, onSave }: {
  orderNumber: string
  review: OrderReviewDto | null
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (rating: number, comment: string) => void
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
  return <div ref={dialogRef} tabIndex={-1} className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <div className="review-dialog-card">
      <header><div><span>سفارش <bdi dir="ltr">#{orderNumber}</bdi></span><h2 id="review-title">امتیاز و نظر شما</h2></div><button className="icon-button" aria-label="بستن" onClick={onClose}><Icon name="cancel" size="md" /></button></header>
      <fieldset className="star-rating"><legend>امتیاز شما</legend><div role="radiogroup" aria-label="امتیاز از یک تا پنج ستاره">{[1, 2, 3, 4, 5].map((star) => <button type="button" role="radio" aria-checked={rating === star} aria-label={`${formatNumber(star)} ستاره`} data-rating={star} tabIndex={rating === star || (rating === 0 && star === 1) ? 0 : -1} className={star <= rating ? 'selected' : ''} key={star} onClick={() => setRating(star)} onKeyDown={(event) => onStarKey(event, star)}><Icon name="rating" size="xl" /></button>)}</div></fieldset>
      <label className="field">نظر شما <span className="optional-label">اختیاری</span><textarea maxLength={1000} rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="تجربه شما از این سفارش…" /><small>{formatNumber(comment.length)} از ۱۰۰۰ نویسه</small></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button full-width" disabled={busy || rating === 0} onClick={() => onSave(rating, comment)}>{busy ? 'در حال ثبت…' : review ? 'ذخیره تغییرات' : 'ثبت امتیاز و نظر'}</button>
    </div>
  </div>
}
