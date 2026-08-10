import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney } from '../utils/format'
import { Icon } from './Icon'

type Props = {
  foodName: string
  /** Current price of one portion as listed — it already includes foreign rice. */
  basePrice: number
  /** The upgrade difference, not the price of a full rice portion. */
  ricePrice: number
  riceTitle: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirms the Persian rice upgrade before it silently changes the price. One component for both
 * breakpoints: CSS turns it into a bottom sheet on phones and a centred modal from 640px up, so the
 * layout never depends on a JS media query that would disagree with the server render.
 */
export function RiceUpgradeDialog({ foodName, basePrice, ricePrice, riceTitle, onConfirm, onCancel }: Props) {
  const [mounted, setMounted] = useState(false)
  const confirmButton = useRef<HTMLButtonElement | null>(null)
  const surface = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    confirmButton.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      if (event.key !== 'Tab') return
      // Keep the keyboard inside the dialog — behind it sits a whole scrollable menu.
      const focusable = surface.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusable?.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [mounted, onCancel])

  if (!mounted) return null

  const upgradedPrice = basePrice + ricePrice

  return createPortal(
    <div className="rice-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <div
        className="rice-dialog"
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rice-dialog-title"
      >
        <div className="rice-dialog-grabber" aria-hidden="true" />
        <header className="rice-dialog-head">
          <span className="rice-dialog-icon" aria-hidden="true"><Icon name="freshIngredients" size="md" /></span>
          <strong id="rice-dialog-title">{riceTitle} برای «{foodName}»</strong>
        </header>

        <ul className="rice-dialog-breakdown">
          <li>
            <span>الان: یک پرس با برنج خارجی</span>
            <strong>{formatMoney(basePrice)}</strong>
          </li>
          <li>
            <span>ارتقا به {riceTitle} (اختلاف قیمت)</span>
            <strong className="rice-dialog-delta">+ {formatMoney(ricePrice)}</strong>
          </li>
          <li className="rice-dialog-total">
            <span>بعد از انتخاب: هر پرس با برنج ایرانی</span>
            <strong>{formatMoney(upgradedPrice)}</strong>
          </li>
        </ul>

        <div className="rice-dialog-actions">
          <button type="button" className="outline-button" onClick={onCancel}>نه، همان برنج خارجی</button>
          <button ref={confirmButton} type="button" className="primary-button" onClick={onConfirm}>
            <Icon name="confirm" size="sm" />
            <span>بله، {formatMoney(upgradedPrice)} برای هر پرس</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
