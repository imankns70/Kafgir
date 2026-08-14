'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './design-system/Icon'
import {
  confirmCustomerOrderDelivered,
  getActiveCustomerOrders,
  getCustomerSession,
  loginCustomerWithTelegram,
} from './services/customerApi'
import { getTelegramInitData } from './services/telegram'
import { OrderStatus, type CustomerOrderSummaryDto } from './types'
import { formatNumber, formatPersianDateTime } from './utils/format'

const mobileMediaQuery = '(max-width: 768px)'
// Keep active tracking timely without turning every open mobile tab into an aggressive Functions poller.
const activePollMs = 60_000
const idlePollMs = 300_000

const steps = [
  { status: OrderStatus.PendingConfirmation, label: 'ثبت شد' },
  { status: OrderStatus.Confirmed, label: 'تأیید شد' },
  { status: OrderStatus.Preparing, label: 'در حال پخت' },
  { status: OrderStatus.Ready, label: 'آماده تحویل' },
] as const

const statusCopy: Partial<Record<OrderStatus, { title: string; description: string }>> = {
  [OrderStatus.PendingConfirmation]: {
    title: 'در انتظار تأیید',
    description: 'سفارشت ثبت شده و منتظر تأیید آشپزخانه است.',
  },
  [OrderStatus.Confirmed]: {
    title: 'سفارش تأیید شد',
    description: 'سفارش تأیید شده و در صف آماده‌سازی قرار دارد.',
  },
  [OrderStatus.Preparing]: {
    title: 'در حال آماده‌سازی',
    description: 'غذای شما در آشپزخانه در حال آماده‌شدن است.',
  },
  [OrderStatus.Ready]: {
    title: 'آماده تحویل',
    description: 'سفارش آماده است. بعد از دریافت، تحویل را همین‌جا تأیید کنید.',
  },
}

function activeStepIndex(status: OrderStatus) {
  return Math.max(0, steps.findIndex((step) => step.status === status))
}

function orderLastUpdate(order: CustomerOrderSummaryDto) {
  const matching = [...order.statusHistories].reverse().find((history) => history.toStatus === order.status)
  return matching?.changedAt ?? order.createdAt
}

export function ActiveOrderTracker() {
  const [isMobile, setIsMobile] = useState(false)
  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([])
  const [expanded, setExpanded] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [deliveryConfirmId, setDeliveryConfirmId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const requestInFlight = useRef(false)
  const authenticated = useRef(false)
  const noticeTimer = useRef<number | null>(null)

  const refresh = useCallback(async (verifySession = false) => {
    if (!isMobile || requestInFlight.current) return
    requestInFlight.current = true
    try {
      let canReadOrders = authenticated.current
      if (verifySession || !canReadOrders) {
        let session = await getCustomerSession()
        const initData = getTelegramInitData()
        if (!session.authenticated && initData) session = await loginCustomerWithTelegram(initData)
        canReadOrders = session.authenticated
        authenticated.current = canReadOrders
      }

      if (!canReadOrders) {
        setOrders([])
        setExpanded(false)
        setSelectedOrderId(null)
        return
      }

      const currentOrders = await getActiveCustomerOrders()
      setOrders(currentOrders)
      setSelectedOrderId((current) => currentOrders.some((order) => order.id === current)
        ? current
        : currentOrders[0]?.id ?? null)
      if (currentOrders.length === 0) {
        setExpanded(false)
        setDeliveryConfirmId(null)
      }
    } catch {
      // A transient network failure must not make in-flight orders disappear from the customer's UI.
      // Only a session verification failure clears the tracker.
      if (verifySession) {
        authenticated.current = false
        setOrders([])
        setExpanded(false)
        setSelectedOrderId(null)
      }
    } finally {
      requestInFlight.current = false
    }
  }, [isMobile])

  useEffect(() => {
    const media = window.matchMedia(mobileMediaQuery)
    const sync = () => {
      setIsMobile(media.matches)
      if (!media.matches) {
        setOrders([])
        setExpanded(false)
        setSelectedOrderId(null)
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    void refresh(true)
  }, [isMobile, refresh])

  useEffect(() => {
    if (!isMobile) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(!authenticated.current)
    }, orders.length > 0 ? activePollMs : idlePollMs)
    return () => window.clearInterval(interval)
  }, [isMobile, orders.length, refresh])

  useEffect(() => {
    if (!isMobile) return
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh(!authenticated.current)
    }
    const refreshSession = () => void refresh(true)
    const refreshOrder = () => void refresh(true)

    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('kafgir:customer-auth-changed', refreshSession)
    window.addEventListener('kafgir:order-changed', refreshOrder)
    return () => {
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('kafgir:customer-auth-changed', refreshSession)
      window.removeEventListener('kafgir:order-changed', refreshOrder)
    }
  }, [isMobile, refresh])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded])

  useEffect(() => () => {
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current)
  }, [])

  const selectedOrder = useMemo(() => (
    orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null
  ), [orders, selectedOrderId])

  const primaryOrder = orders[0] ?? null
  const primaryIndex = primaryOrder ? activeStepIndex(primaryOrder.status) : 0
  const primaryProgress = ((primaryIndex + 1) / steps.length) * 100

  const confirmDelivery = async (order: CustomerOrderSummaryDto) => {
    if (confirmingId != null) return
    setConfirmingId(order.id)
    setActionError(null)
    try {
      await confirmCustomerOrderDelivered(order.id)
      const remaining = orders.filter((item) => item.id !== order.id)
      setOrders(remaining)
      setSelectedOrderId(remaining[0]?.id ?? null)
      setDeliveryConfirmId(null)
      if (remaining.length === 0) setExpanded(false)

      setNotice(`تحویل سفارش #${formatNumber(order.orderNumber)} ثبت شد.`)
      if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setNotice(null), 3_500)
      void refresh(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'ثبت تحویل سفارش ممکن نشد.')
    } finally {
      setConfirmingId(null)
    }
  }

  if (!isMobile) return null

  if (!primaryOrder) {
    return notice ? <div className="active-order-toast" role="status"><Icon name="confirm" size="sm" /> {notice}</div> : null
  }

  const primaryCopy = statusCopy[primaryOrder.status] ?? statusCopy[OrderStatus.PendingConfirmation]!
  const selectedCopy = selectedOrder
    ? statusCopy[selectedOrder.status] ?? statusCopy[OrderStatus.PendingConfirmation]!
    : primaryCopy
  const selectedIndex = selectedOrder ? activeStepIndex(selectedOrder.status) : 0
  const deliveryWindow = selectedOrder?.deliveryTimeSlotTitle
    ? `${selectedOrder.deliveryTimeSlotTitle}${selectedOrder.deliveryStartTime && selectedOrder.deliveryEndTime
      ? `، ${selectedOrder.deliveryStartTime} تا ${selectedOrder.deliveryEndTime}`
      : ''}`
    : null

  return <>
    {notice && <div className="active-order-toast" role="status"><Icon name="confirm" size="sm" /> {notice}</div>}

    <aside className="active-order-tracker-root" aria-live="polite">
      <button
        type="button"
        className="active-order-pill"
        onClick={() => {
          setSelectedOrderId((current) => current ?? primaryOrder.id)
          setActionError(null)
          setExpanded(true)
        }}
        aria-label={orders.length > 1
          ? `${formatNumber(orders.length)} سفارش جاری؛ مشاهده وضعیت`
          : `سفارش جاری ${primaryOrder.orderNumber}؛ ${primaryCopy.title}. مشاهده وضعیت`}
      >
        <span className="active-order-pill-icon" aria-hidden="true"><Icon name="orders" size="sm" /></span>
        <span className="active-order-pill-copy">
          <small>{orders.length > 1
            ? `${formatNumber(orders.length)} سفارش جاری`
            : `سفارش #${formatNumber(primaryOrder.orderNumber)}`}</small>
          <strong>{orders.length > 1 ? 'مشاهده وضعیت سفارش‌ها' : primaryCopy.title}</strong>
          <span className="active-order-mini-progress" aria-hidden="true"><i style={{ width: `${primaryProgress}%` }} /></span>
        </span>
        <span className="active-order-pill-action">پیگیری <Icon name="back" size="xs" /></span>
      </button>
    </aside>

    {expanded && selectedOrder && <>
      <button type="button" className="active-order-sheet-backdrop" aria-label="بستن وضعیت سفارش" onClick={() => setExpanded(false)} />
      <section className="active-order-sheet" role="dialog" aria-modal="true" aria-labelledby="active-order-title">
        <div className="active-order-sheet-handle" aria-hidden="true" />
        <header className="active-order-sheet-header">
          <div>
            <span>{orders.length > 1 ? 'سفارش‌های در جریان' : 'سفارش جاری'}</span>
            <h2 id="active-order-title">{orders.length > 1
              ? `${formatNumber(orders.length)} سفارش فعال`
              : <><bdi>#{formatNumber(selectedOrder.orderNumber)}</bdi> · {selectedCopy.title}</>}</h2>
          </div>
          <button type="button" className="active-order-sheet-close" aria-label="بستن" onClick={() => setExpanded(false)}>×</button>
        </header>

        {orders.length > 1 && <div className="active-order-list" aria-label="فهرست سفارش‌های جاری">
          {orders.map((order) => {
            const copy = statusCopy[order.status] ?? statusCopy[OrderStatus.PendingConfirmation]!
            const index = activeStepIndex(order.status)
            return <button key={order.id} type="button"
              className={`active-order-list-item ${order.id === selectedOrder.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedOrderId(order.id)
                setDeliveryConfirmId(null)
                setActionError(null)
              }}>
              <span className="active-order-list-main">
                <strong><bdi>#{formatNumber(order.orderNumber)}</bdi></strong>
                <small>{copy.title}</small>
              </span>
              <span className="active-order-list-foods">{order.foodSummary || 'سفارش ثبت‌شده'}</span>
              <span className="active-order-list-progress" aria-hidden="true"><i style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></span>
            </button>
          })}
        </div>}

        <div className="active-order-current-state">
          <span className="active-order-state-icon" aria-hidden="true"><Icon name="orders" size="lg" /></span>
          <div>
            <strong>{selectedCopy.title}</strong>
            <p>{selectedCopy.description}</p>
            <time>آخرین به‌روزرسانی: {formatPersianDateTime(orderLastUpdate(selectedOrder))}</time>
          </div>
        </div>

        <ol className="active-order-steps" aria-label="مراحل سفارش">
          {steps.map((step, index) => {
            const reached = index <= selectedIndex
            const current = index === selectedIndex
            return <li key={step.status} className={`${reached ? 'reached' : ''} ${current ? 'current' : ''}`} aria-current={current ? 'step' : undefined}>
              <span className="active-order-step-dot">{index < selectedIndex ? '✓' : current ? '●' : '○'}</span>
              <small>{step.label}</small>
            </li>
          })}
        </ol>

        <div className="active-order-sheet-summary">
          <div><span className="active-order-summary-icon"><Icon name="orders" size="sm" /></span><p><small>اقلام سفارش</small><strong>{selectedOrder.foodSummary || 'سفارش ثبت‌شده'}</strong></p></div>
          {deliveryWindow && <div><span className="active-order-summary-icon"><Icon name="clock" size="sm" /></span><p><small>زمان تحویل</small><strong>{deliveryWindow}</strong></p></div>}
          <div><span className="active-order-summary-icon"><Icon name="location" size="sm" /></span><p><small>نشانی تحویل</small><strong>{selectedOrder.deliveryCity}، {selectedOrder.addressLine}</strong></p></div>
        </div>

        {selectedOrder.status === OrderStatus.Ready && <div className="active-order-delivery-action">
          {deliveryConfirmId === selectedOrder.id
            ? <div className="active-order-delivery-confirm" role="group" aria-label="تأیید دریافت سفارش">
                <p>سفارش واقعاً به دستتان رسیده است؟ با تأیید، وضعیت سفارش «تحویل شده» ثبت می‌شود.</p>
                <div>
                  <button type="button" className="outline-button" disabled={confirmingId === selectedOrder.id}
                    onClick={() => setDeliveryConfirmId(null)}>انصراف</button>
                  <button type="button" className="primary-button" disabled={confirmingId === selectedOrder.id}
                    onClick={() => void confirmDelivery(selectedOrder)}>
                    <Icon name="confirm" size="sm" /> {confirmingId === selectedOrder.id ? 'در حال ثبت…' : 'بله، تحویل گرفتم'}
                  </button>
                </div>
              </div>
            : <button type="button" className="primary-button active-order-received-button"
                onClick={() => { setActionError(null); setDeliveryConfirmId(selectedOrder.id) }}>
                <Icon name="confirm" size="sm" /> تحویل گرفتم
              </button>}
        </div>}

        {actionError && <div className="active-order-action-error" role="alert">{actionError}</div>}
        <p className="active-order-sheet-note">این پنجره تا زمان تحویل یا لغو سفارش روی موبایل در دسترس می‌ماند و وضعیت آن خودکار به‌روزرسانی می‌شود.</p>
      </section>
    </>}
  </>
}
