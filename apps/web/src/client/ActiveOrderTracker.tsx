'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './design-system/Icon'
import {
  getActiveCustomerOrder,
  getCustomerSession,
  loginCustomerWithTelegram,
} from './services/customerApi'
import { getTelegramInitData } from './services/telegram'
import { OrderStatus, type CustomerOrderSummaryDto } from './types'
import { formatNumber } from './utils/format'

const mobileMediaQuery = '(max-width: 768px)'
const activePollMs = 45_000
const idlePollMs = 120_000

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
    description: 'سفارش آماده است و وارد مرحله تحویل شده است.',
  },
}

function activeStepIndex(status: OrderStatus) {
  return Math.max(0, steps.findIndex((step) => step.status === status))
}

export function ActiveOrderTracker() {
  const [isMobile, setIsMobile] = useState(false)
  const [order, setOrder] = useState<CustomerOrderSummaryDto | null>(null)
  const [expanded, setExpanded] = useState(false)
  const requestInFlight = useRef(false)
  const authenticated = useRef(false)

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
        setOrder(null)
        setExpanded(false)
        return
      }

      const currentOrder = await getActiveCustomerOrder()
      setOrder(currentOrder)
      if (!currentOrder) setExpanded(false)
    } catch {
      // A transient network failure must not make an in-flight order disappear from the customer's UI.
      // Only a session verification failure clears the tracker.
      if (verifySession) {
        authenticated.current = false
        setOrder(null)
        setExpanded(false)
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
        setOrder(null)
        setExpanded(false)
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
    }, order ? activePollMs : idlePollMs)
    return () => window.clearInterval(interval)
  }, [isMobile, order, refresh])

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

  const currentIndex = useMemo(() => order ? activeStepIndex(order.status) : 0, [order])
  const progress = ((currentIndex + 1) / steps.length) * 100

  if (!isMobile || !order) return null

  const copy = statusCopy[order.status] ?? statusCopy[OrderStatus.PendingConfirmation]!
  const deliveryWindow = order.deliveryTimeSlotTitle
    ? `${order.deliveryTimeSlotTitle}${order.deliveryStartTime && order.deliveryEndTime
      ? `، ${order.deliveryStartTime} تا ${order.deliveryEndTime}`
      : ''}`
    : null

  return <>
    <aside className="active-order-tracker-root" aria-live="polite">
      <button
        type="button"
        className="active-order-pill"
        onClick={() => setExpanded(true)}
        aria-label={`سفارش جاری ${order.orderNumber}؛ ${copy.title}. مشاهده وضعیت`}
      >
        <span className="active-order-pill-icon" aria-hidden="true"><Icon name="orders" size="md" /></span>
        <span className="active-order-pill-copy">
          <small>سفارش جاری <bdi>#{formatNumber(order.orderNumber)}</bdi></small>
          <strong>{copy.title}</strong>
          <span className="active-order-mini-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></span>
        </span>
        <span className="active-order-pill-action">وضعیت <Icon name="back" size="sm" /></span>
      </button>
    </aside>

    {expanded && <>
      <button type="button" className="active-order-sheet-backdrop" aria-label="بستن وضعیت سفارش" onClick={() => setExpanded(false)} />
      <section className="active-order-sheet" role="dialog" aria-modal="true" aria-labelledby="active-order-title">
        <div className="active-order-sheet-handle" aria-hidden="true" />
        <header className="active-order-sheet-header">
          <div>
            <span>سفارش جاری</span>
            <h2 id="active-order-title"><bdi>#{formatNumber(order.orderNumber)}</bdi> · {copy.title}</h2>
          </div>
          <button type="button" className="active-order-sheet-close" aria-label="بستن" onClick={() => setExpanded(false)}>×</button>
        </header>

        <div className="active-order-current-state">
          <span className="active-order-state-icon" aria-hidden="true"><Icon name="orders" size="lg" /></span>
          <div><strong>{copy.title}</strong><p>{copy.description}</p></div>
        </div>

        <ol className="active-order-steps" aria-label="مراحل سفارش">
          {steps.map((step, index) => {
            const reached = index <= currentIndex
            const current = index === currentIndex
            return <li key={step.status} className={`${reached ? 'reached' : ''} ${current ? 'current' : ''}`} aria-current={current ? 'step' : undefined}>
              <span className="active-order-step-dot">{index < currentIndex ? '✓' : current ? '●' : '○'}</span>
              <small>{step.label}</small>
            </li>
          })}
        </ol>

        <div className="active-order-sheet-summary">
          <div><span className="active-order-summary-icon"><Icon name="orders" size="sm" /></span><p><small>اقلام سفارش</small><strong>{order.foodSummary || 'سفارش ثبت‌شده'}</strong></p></div>
          {deliveryWindow && <div><span className="active-order-summary-icon"><Icon name="clock" size="sm" /></span><p><small>زمان تحویل</small><strong>{deliveryWindow}</strong></p></div>}
          <div><span className="active-order-summary-icon"><Icon name="location" size="sm" /></span><p><small>نشانی تحویل</small><strong>{order.deliveryCity}، {order.addressLine}</strong></p></div>
        </div>

        <p className="active-order-sheet-note">این وضعیت تا زمان تحویل یا لغو سفارش روی موبایل در دسترس می‌ماند و خودکار به‌روزرسانی می‌شود.</p>
      </section>
    </>}
  </>
}
