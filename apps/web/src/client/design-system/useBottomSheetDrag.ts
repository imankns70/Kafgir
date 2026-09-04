import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

export type SheetSnap = 'half' | 'full'

/** Fractions of the viewport height each resting position occupies. */
const snapFraction: Record<SheetSnap, number> = { half: 0.55, full: 0.9 }
const minimumFraction = 0.28
const maximumFraction = 0.94

/**
 * Drag behaviour for a bottom sheet: pull the grip up to enlarge it, down to shrink it, and further
 * down to dismiss it. A sheet that can only be opened and closed feels like a page that appeared in
 * the wrong place; being able to size it is what makes it read as a panel the customer owns.
 *
 * The drag lives on the grip and header only, so a scrollable body still scrolls. Heights are
 * measured against the live viewport rather than being fixed, so a phone keyboard or a rotated
 * screen cannot leave the sheet taller than the room available.
 */
export function useBottomSheetDrag({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [snap, setSnap] = useState<SheetSnap>('half')
  const [draggedHeight, setDraggedHeight] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; height: number } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSnap('half')
      setDraggedHeight(null)
      dragStart.current = null
    }
  }, [isOpen])

  const viewport = () => (typeof window === 'undefined' ? 0 : window.innerHeight)

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const sheet = event.currentTarget.closest<HTMLElement>('[data-sheet]')
    if (!sheet) return
    dragStart.current = { y: event.clientY, height: sheet.getBoundingClientRect().height }
    setDraggedHeight(dragStart.current.height)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const start = dragStart.current
    if (!start) return
    const height = start.height + (start.y - event.clientY)
    setDraggedHeight(Math.min(Math.max(height, 80), viewport() * maximumFraction))
  }, [])

  const endDrag = useCallback(() => {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    setDraggedHeight((height) => {
      if (height == null) return null
      // Dragged below the smallest useful size: the customer is putting the sheet away.
      if (height < viewport() * minimumFraction) {
        onClose()
        return null
      }
      const distanceTo = (candidate: SheetSnap) => Math.abs(height - viewport() * snapFraction[candidate])
      setSnap(distanceTo('half') <= distanceTo('full') ? 'half' : 'full')
      return null
    })
  }, [onClose])

  const sheetProps = {
    'data-sheet': '',
    'data-snap': snap,
    'data-dragging': draggedHeight != null ? '' : undefined,
    style: draggedHeight != null ? ({ height: `${Math.round(draggedHeight)}px` } as CSSProperties) : undefined,
  }

  const gripProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    /** Tapping the grip toggles the two resting sizes, for anyone who cannot drag. */
    onClick: () => setSnap((current) => (current === 'half' ? 'full' : 'half')),
  }

  return { snap, setSnap, sheetProps, gripProps }
}
