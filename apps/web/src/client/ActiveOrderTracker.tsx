'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildInvoiceOrderLines } from '@kafgir/contracts'
import { Icon, type IconName } from './design-system/Icon'
import { useBottomSheetDrag } from './design-system/useBottomSheetDrag'
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

type StatusLook = { title: string; description: string; icon: IconName; tone: 'waiting' | 'confirmed' | 'cooking' | 'ready' }

const statusCopy: Partial<Record<OrderStatus, StatusLook>> = {
  [OrderStatus.PendingConfirmation]: {
    title: 'در انتظار تأیید',
    description: 'سفارشت ثبت شده و منتظر تأیید آشپزخانه است.',
    icon: 'clock',
    tone: 'waiting',
  },
  [OrderStatus.Confirmed]: {
    title: 'سفارش تأیید شد',
    description: 'سفارش تأیید شده و در صف آماده‌سازی قرار دارد.',
    icon: 'confirm',
    tone: 'confirmed',
  },
  [OrderStatus.Preparing]: {
    title: 'در حال آماده‌سازی',
    description: 'غذای شما در آشپزخانه در حال آماده‌شدن است.',
    icon: 'kitchen',
    tone: 'cooking',
  },
  [OrderStatus.Ready]: {
    title: 'آماده تحویل',
    description: 'سفارش آماده است. بعد از دریافت، تحویل را همین‌جا تأیید کنید.',
    icon: 'packaging',
    tone: 'ready',
  },
}

const lookFor = (status: OrderStatus): StatusLook => statusCopy[status] ?? statusCopy[OrderStatus.PendingConfirmation]!

/** «همین الان», «۵ دقیقه پیش», «۲ ساعت پیش» — a status is read for how fresh it is, not its clock time. */
export function formatSinceUpdate(value: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'همین الان'
  if (minutes < 60) return `${formatNumber(minutes)} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${formatNumber(hours)} ساعت پیش`
  return formatPersianDateTime(value)
}

function deliveryWindowOf(order: CustomerOrderSummaryDto) {
  if (order.deliveryStartTime && order.deliveryEndTime) return `${order.deliveryStartTime} تا ${order.deliveryEndTime}`
  return null
}

/** Asks the app shell for one of its pages; a page outside the shell (a food page) navigates instead. */
function openAppPage(page: 'orders' | 'contact') {
  const handled = !window.dispatchEvent(new CustomEvent('kafgir:navigate', { detail: page, cancelable: true }))
  if (!handled) window.location.assign(`/?page=${page}`)
}

function activeStepIndex(status: OrderStatus) {
  return Math.max(0, steps.findIndex((step) => step.status === status))
}

function orderLastUpdate(order: CustomerOrderSummaryDto) {
  const matching = [...order.statusHistories].reverse().find((history) => history.toStatus === order.status)
  return matching?.changedAt ?? order.createdAt
}

const persianRiceSuffix = ' (با برنج ایرانی)'

/**
 * One row per food with its quantity, instead of a comma-run sentence. The Persian-rice add-on is a
 * separate stored line; it is folded into its dish here exactly as the invoice does, and shown as a
 * small tag under the dish's name.
 */
export function OrderItemList({ order }: { order: CustomerOrderSummaryDto }) {
  const lines = buildInvoiceOrderLines(order.foodItems ?? [])
  if (lines.length === 0) return <strong>{order.foodSummary || 'سفارش ثبت‌شده'}</strong>
  return <ul className="active-order-items">
    {lines.map((line) => {
      const withRice = line.key.includes(':rice:')
      return <li key={line.key}>
        <span className="active-order-item-name">
          {withRice ? line.foodName.replace(persianRiceSuffix, '') : line.foodName}
          {withRice && <small className="active-order-item-addon">با برنج ایرانی</small>}
        </span>
        <span className="active-order-item-qty">{formatNumber(line.quantity)}×</span>
      </li>
    })}
  </ul>
}

export function ActiveOrderTracker() {
  const [isMobile, setIsMobile] = useState(false)
  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([])
  const [expanded, setExpanded] = useState(false)
  const closeSheet = useCallback(() => setExpanded(false), [])
  const { sheetProps, gripProps } = useBottomSheetDrag({ isOpen: expanded, onClose: closeSheet })
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
  const showsPill = isMobile && primaryOrder != null

  // The pill floats above the tab bar, which is all the room pages reserve at their foot; without
  // more, the end of every page (a total, a print button) sat under it and could not be scrolled into
  // view. The class lets the page shell make room only while the pill is on screen.
  useEffect(() => {
    if (!showsPill) return
    document.documentElement.classList.add('has-active-order-pill')
    return () => document.documentElement.classList.remove('has-active-order-pill')
  }, [showsPill])
  const primaryIndex = primaryOrder ? activeStepIndex(primaryOrder.status) : 0

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

  const primaryLook = lookFor(primaryOrder.status)
  const selectedLook = selectedOrder ? lookFor(selectedOrder.status) : primaryLook
  const selectedIndex = selectedOrder ? activeStepIndex(selectedOrder.status) : 0
  const selectedWindow = selectedOrder ? deliveryWindowOf(selectedOrder) : null
  const primaryWindow = deliveryWindowOf(primaryOrder)
  const readyCount = orders.filter((order) => order.status === OrderStatus.Ready).length
  const multiple = orders.length > 1
  const pillLook = multiple && readyCount > 0 ? lookFor(OrderStatus.Ready) : primaryLook

  return <>
    {notice && <div className="active-order-toast" role="status"><Icon name="confirm" size="sm" /> {notice}</div>}

    <aside className="active-order-tracker-root" aria-live="polite">
      <button
        type="button"
        className={`active-order-pill tone-${pillLook.tone}`}
        onClick={() => {
          setSelectedOrderId((current) => current ?? primaryOrder.id)
          setActionError(null)
          setExpanded(true)
        }}
        aria-label={multiple
          ? `${formatNumber(orders.length)} سفارش در جریان؛ مشاهده وضعیت`
          : `سفارش ${primaryOrder.orderNumber}؛ ${primaryLook.title}. مشاهده وضعیت`}
      >
        <span className="active-order-pill-icon" aria-hidden="true"><Icon name={pillLook.icon} size="md" /></span>
        <span className="active-order-pill-copy">
          <strong>{multiple ? `${formatNumber(orders.length)} سفارش در جریان` : primaryLook.title}</strong>
          <small>{multiple
            ? readyCount > 0 ? `${formatNumber(readyCount)} سفارش آماده تحویل است` : 'برای دیدن وضعیت هر سفارش بزنید'
            : <><bdi dir="ltr">#{primaryOrder.orderNumber}</bdi>{primaryWindow && <> · تحویل {primaryWindow}</>}</>}</small>
          {!multiple && <span className="active-order-pill-steps" aria-hidden="true">
            {steps.map((step, index) => <i key={step.status} className={index < primaryIndex ? 'done' : index === primaryIndex ? 'now' : ''} />)}
          </span>}
        </span>
        <span className="active-order-pill-open" aria-hidden="true"><Icon name="back" size="sm" /></span>
      </button>
    </aside>

    {expanded && selectedOrder && <>
      <button type="button" className="active-order-sheet-backdrop" aria-label="بستن وضعیت سفارش" onClick={() => setExpanded(false)} />
      <section className={`active-order-sheet tone-${selectedLook.tone}`} role="dialog" aria-modal="true" aria-labelledby="active-order-title" {...sheetProps}>
        {/* The grip is the drag target: pull up to enlarge, down to shrink, further down to close.
            A plain tap toggles the two sizes for anyone who cannot drag. */}
        <button type="button" className="active-order-sheet-handle" aria-label="تغییر اندازه پنجره سفارش" {...gripProps} />
        <header className="active-order-sheet-header" onPointerDown={gripProps.onPointerDown} onPointerMove={gripProps.onPointerMove} onPointerUp={gripProps.onPointerUp} onPointerCancel={gripProps.onPointerCancel}>
          <div>
            <span>{multiple ? `${formatNumber(orders.length)} سفارش در جریان` : 'سفارش در جریان'}</span>
            <h2 id="active-order-title"><bdi dir="ltr">#{selectedOrder.orderNumber}</bdi></h2>
          </div>
          <button type="button" className="active-order-sheet-close" aria-label="بستن" onClick={() => setExpanded(false)}><Icon name="cancel" size="sm" /></button>
        </header>

        {multiple && <div className="active-order-tabs" role="tablist" aria-label="سفارش‌های در جریان">
          {orders.map((order) => {
            const look = lookFor(order.status)
            return <button key={order.id} type="button" role="tab" aria-selected={order.id === selectedOrder.id}
              className={`active-order-tab tone-${look.tone}${order.id === selectedOrder.id ? ' selected' : ''}`}
              onClick={() => {
                setSelectedOrderId(order.id)
                setDeliveryConfirmId(null)
                setActionError(null)
              }}>
              <i aria-hidden="true" />
              <span><bdi dir="ltr">#{order.orderNumber.split('-').pop()}</bdi><small>{look.title}</small></span>
            </button>
          })}
        </div>}

        <div className={`active-order-hero tone-${selectedLook.tone}`}>
          <span className="active-order-hero-icon" aria-hidden="true"><Icon name={selectedLook.icon} size="lg" /></span>
          <div>
            <strong>{selectedLook.title}</strong>
            <p>{selectedLook.description}</p>
            <time dateTime={orderLastUpdate(selectedOrder)}>به‌روزرسانی {formatSinceUpdate(orderLastUpdate(selectedOrder))}</time>
          </div>
        </div>

        <ol className="active-order-track" aria-label="مراحل سفارش">
          {steps.map((step, index) => {
            const done = index < selectedIndex
            const current = index === selectedIndex
            return <li key={step.status} className={`${done ? 'done' : ''}${current ? ' now' : ''}`} aria-current={current ? 'step' : undefined}>
              <span className="active-order-track-bar" aria-hidden="true" />
              <small>{step.label}</small>
            </li>
          })}
        </ol>

        {selectedWindow && <div className="active-order-window">
          <Icon name="clock" size="md" />
          <div><small>زمان تحویل{selectedOrder.deliveryTimeSlotTitle ? ` · ${selectedOrder.deliveryTimeSlotTitle}` : ''}</small><strong>{selectedWindow}</strong></div>
        </div>}

        <section className="active-order-block" aria-label="اقلام سفارش">
          <h3><Icon name="food" size="sm" /> اقلام سفارش</h3>
          <OrderItemList order={selectedOrder} />
        </section>

        <section className="active-order-block" aria-label="نشانی تحویل">
          <h3><Icon name="location" size="sm" /> نشانی تحویل</h3>
          <p>{selectedOrder.deliveryCity}، {selectedOrder.addressLine}</p>
        </section>

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
                <Icon name="confirm" size="sm" /> سفارش را تحویل گرفتم
              </button>}
        </div>}

        {actionError && <div className="active-order-action-error" role="alert">{actionError}</div>}

        <div className="active-order-links">
          <button type="button" onClick={() => { setExpanded(false); openAppPage('orders') }}><Icon name="orders" size="sm" /> جزئیات کامل</button>
          <button type="button" onClick={() => { setExpanded(false); openAppPage('contact') }}><Icon name="support" size="sm" /> پشتیبانی</button>
        </div>
        <p className="active-order-sheet-note"><span aria-hidden="true" /> وضعیت خودکار به‌روز می‌شود تا سفارش تحویل یا لغو شود.</p>
      </section>
    </>}
  </>
}
