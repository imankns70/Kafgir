'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PendingOrderReviewDto } from '../../types'
import { getPendingOrderReview, saveCustomerOrderReview } from '../../services/customerApi'
import { OrderReviewDialog } from '../profile/CustomerOrders'
import { Icon } from '../../design-system/Icon'
import { isOrderDismissed, rememberDismissedOrder } from '../../services/reviewPromptDismissal'

/**
 * Asks the customer to rate a delivered order, the way a ride-hailing app asks after a trip.
 *
 * The prompt is driven by a lookup on app open rather than by a live delivery event: the admin
 * usually marks an order delivered while the customer is not looking at the app, so anything that
 * required them to be present at that moment would simply never fire.
 */

export function PostDeliveryReviewPrompt({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [pending, setPending] = useState<PendingOrderReviewDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanked, setThanked] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { setPending(null); return }
    let cancelled = false
    getPendingOrderReview()
      .then((candidate) => {
        if (cancelled || !candidate) return
        if (isOrderDismissed(candidate.orderId)) return
        setPending(candidate)
      })
      // A failed lookup is not worth surfacing; the customer can still rate from order history.
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [isAuthenticated])

  const later = useCallback(() => {
    if (pending) rememberDismissedOrder(pending.orderId)
    setPending(null)
  }, [pending])

  const submit = useCallback(async (rating: number, comment: string) => {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveCustomerOrderReview(pending.orderId, { rating, comment: comment.trim() || null })
      // Suppress this order for the session too: the server will not return it again, but a
      // reload racing the write should not ask twice.
      rememberDismissedOrder(pending.orderId)
      setThanked(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ثبت امتیاز ممکن نشد.')
    } finally {
      setBusy(false)
    }
  }, [pending, busy])

  if (thanked) {
    return <div className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-thanks-title">
      <div className="review-dialog-card review-thanks-card">
        <Icon name="rating" size="xl" className="selected" />
        <h2 id="review-thanks-title">ممنون از نظرت ❤️</h2>
        <p>نظر شما ثبت شد.</p>
        <button className="primary-button full-width" onClick={() => { setThanked(false); setPending(null) }}>بستن</button>
      </div>
    </div>
  }

  if (!pending) return null

  return <OrderReviewDialog
    key={pending.orderId}
    orderNumber={pending.orderNumber}
    review={null}
    busy={busy}
    error={error}
    title="سفارشت چطور بود؟ 🍽️"
    intro="تجربه‌ات از این سفارش رو به ما بگو."
    onClose={later}
    onLater={later}
    onSave={(rating, comment) => void submit(rating, comment)}
  />
}
