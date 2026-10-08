import { useEffect, useRef, useState } from 'react'
import { adminApi } from './api'
import { formatMoney } from './number-format'

const storageKey = 'kafgir.admin.orderAlerts'
const pollMs = 20_000

const readEnabled = () => {
  try { return window.localStorage.getItem(storageKey) !== 'off' } catch { return true }
}

/** Two short rising tones from Web Audio, so the alert needs no sound file and survives packaging. */
export function playOrderChime() {
  try {
    const context = new AudioContext()
    const tones = [[880, 0], [1320, 0.18]] as const
    for (const [frequency, start] of tones) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, context.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.3)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + start)
      oscillator.stop(context.currentTime + start + 0.32)
    }
    window.setTimeout(() => void context.close(), 800)
  } catch { /* no audio device: the desktop notification still shows */ }
}

/** The alert text for one or several new orders. */
export function newOrderMessage(orders: Array<{ orderNumber: string; customerFullName: string; totalAmount: number }>) {
  if (orders.length === 1) {
    const [order] = orders
    return { title: `سفارش تازه ${order!.orderNumber}`, body: `${order!.customerFullName} — ${formatMoney(order!.totalAmount)}` }
  }
  return { title: `${orders.length} سفارش تازه`, body: orders.map((order) => order.orderNumber).join('، ') }
}

/**
 * Watches for orders newer than the last one seen and announces them with a chime and a desktop
 * notification; clicking the notification brings Admin forward on the orders page. The operator can
 * mute it, and the choice is remembered on this computer.
 */
export function useNewOrderAlerts(active: boolean, onOpenOrders: () => void) {
  const [enabled, setEnabled] = useState(readEnabled)
  const [unseen, setUnseen] = useState(0)
  const lastId = useRef<number | null>(null)
  const openRef = useRef(onOpenOrders)
  openRef.current = onOpenOrders

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, enabled ? 'on' : 'off') } catch { /* private storage */ }
    if (enabled && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  }, [enabled])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const check = async () => {
      try {
        const result = await adminApi.ordersSince(lastId.current)
        if (cancelled) return
        const fresh = lastId.current == null ? [] : result.orders
        lastId.current = Math.max(lastId.current ?? 0, result.latestId)
        if (fresh.length === 0) return
        setUnseen((count) => count + fresh.length)
        if (!enabled) return
        playOrderChime()
        if ('Notification' in window && Notification.permission === 'granted') {
          const message = newOrderMessage(fresh)
          const notification = new Notification(message.title, { body: message.body, tag: 'kafgir-new-order' })
          notification.onclick = () => { window.focus(); openRef.current() }
        }
      } catch { /* a failed poll is retried on the next tick */ }
    }
    void check()
    const timer = window.setInterval(() => void check(), pollMs)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [active, enabled])

  useEffect(() => {
    const base = 'مدیریت کفگیر'
    document.title = unseen > 0 ? `(${unseen}) ${base}` : base
  }, [unseen])

  return { enabled, setEnabled, unseen, clearUnseen: () => setUnseen(0) }
}
