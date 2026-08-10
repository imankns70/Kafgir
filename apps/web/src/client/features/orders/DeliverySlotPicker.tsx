import { useEffect, useState } from 'react'
import type { AvailableDeliverySlotDto, DeliverySlotOptionsDto } from '@kafgir/contracts'
import { DeliverySlotUnavailableReason } from '@kafgir/contracts'
import { Icon } from '../../design-system/Icon'
import { getDeliverySlots } from '../../services/deliveryApi'
import { formatDeliveryWindow, formatPersianDay } from '../../utils/format'

type Props = {
  selectedSlotId: number | null
  onSelect: (slotId: number | null) => void
  /** Told the resolved business delivery date, so the form can show and submit against it. */
  onDateResolved?: (deliveryDate: string) => void
}

const unavailableLabels: Record<DeliverySlotUnavailableReason, string> = {
  [DeliverySlotUnavailableReason.Inactive]: 'غیرفعال',
  [DeliverySlotUnavailableReason.DisabledForDate]: 'برای این روز فعال نیست',
  [DeliverySlotUnavailableReason.CutoffPassed]: 'زمان انتخاب این بازه گذشته است',
  [DeliverySlotUnavailableReason.CapacityFull]: 'تکمیل ظرفیت',
}

/**
 * Radio-card window picker. Unavailable windows stay visible but disabled, because "full" and "too
 * late" are useful information — a vanished row just looks like the shop is broken. The reason text
 * carries the meaning so the state never depends on colour alone.
 */
export function DeliverySlotPicker({ selectedSlotId, onSelect, onDateResolved }: Props) {
  const [options, setOptions] = useState<DeliverySlotOptionsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // No date is sent: the server decides which business day this basket delivers on, so the browser
  // clock can never shift the answer.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getDeliverySlots()
      .then((result) => {
        if (!active) return
        setOptions(result)
        onDateResolved?.(result.deliveryDate)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت بازه‌های ارسال ممکن نشد.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onDateResolved])

  // A window chosen before the list refreshed may have filled in the meantime. Drop it so the form
  // cannot submit a selection the server has already rejected.
  useEffect(() => {
    if (!options || selectedSlotId == null) return
    const stillSelectable = options.slots.some(
      (slot) => slot.id === selectedSlotId && slot.isAvailable,
    )
    if (!stillSelectable) onSelect(null)
  }, [options, selectedSlotId, onSelect])

  const deliveryDate = options?.deliveryDate ?? null
  const slots = options?.slots ?? []
  const availableCount = slots.filter((slot) => slot.isAvailable).length

  // The reason matters: telling a customer the day is full when in fact ordering has simply closed
  // for today sends them to refresh a page that will never change.
  const everyReason = new Set(slots.map((slot) => slot.unavailableReason))
  const emptyMessage = slots.length === 0
    ? 'برای این روز بازه ارسال فعالی وجود ندارد.'
    : everyReason.size === 1 && everyReason.has(DeliverySlotUnavailableReason.CutoffPassed)
    ? 'مهلت سفارش برای همه بازه‌های ارسال امروز به پایان رسیده است.'
    : everyReason.size === 1 && everyReason.has(DeliverySlotUnavailableReason.CapacityFull)
    ? 'ظرفیت ارسال این روز تکمیل شده است.'
    : 'در حال حاضر هیچ بازه ارسالی برای این روز قابل انتخاب نیست.'

  return <section className="delivery-slot-section" aria-labelledby="delivery-slot-title">
    <h3 id="delivery-slot-title" className="delivery-slot-title">
      <Icon name="clock" size="sm" aria-hidden="true" /> زمان تحویل
    </h3>

    {deliveryDate && <p className="delivery-slot-day">
      <span className="delivery-slot-day-label">روز تحویل</span>
      <strong>{formatPersianDay(deliveryDate)}</strong>
    </p>}

    {loading && <p className="muted">در حال بررسی بازه‌های ارسال…</p>}
    {error && <p className="delivery-slot-error" role="alert">{error}</p>}

    {!loading && !error && availableCount === 0 && <p className="delivery-slot-empty" role="status">
      <Icon name="info" size="xs" aria-hidden="true" /> {emptyMessage}
    </p>}

    {slots.length > 0 && <div className="delivery-slot-options" role="radiogroup" aria-label="انتخاب بازه زمانی">
      {slots.map((slot) => <SlotOption
        key={slot.id}
        slot={slot}
        isSelected={slot.id === selectedSlotId}
        onSelect={() => onSelect(slot.id)}
      />)}
    </div>}
  </section>
}

function SlotOption({ slot, isSelected, onSelect }: {
  slot: AvailableDeliverySlotDto
  isSelected: boolean
  onSelect: () => void
}) {
  const reasonLabel = slot.unavailableReason ? unavailableLabels[slot.unavailableReason] : null
  return <label className={`delivery-slot-option ${slot.isAvailable ? '' : 'is-unavailable'}`}>
    <input
      type="radio"
      name="deliveryTimeSlot"
      value={slot.id}
      checked={isSelected}
      disabled={!slot.isAvailable}
      onChange={onSelect}
    />
    <span className="delivery-slot-option-body">
      <span className="delivery-slot-window">{formatDeliveryWindow(slot.startTime, slot.endTime)}</span>
      <span className="delivery-slot-meta">{reasonLabel ?? slot.title}</span>
    </span>
    {isSelected && <Icon name="confirm" size="sm" aria-hidden="true" />}
  </label>
}
