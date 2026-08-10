import type {
  AdminDeliveryDayDto,
  AdminDeliveryTimeSlotDto,
  DeliveryDayOverrideRequest,
  DeliverySlotOptionsDto,
  DeliveryTimeSlotWriteRequest,
} from '@kafgir/contracts'
import { DeliverySlotUnavailableReason, OrderStatus } from '@kafgir/contracts'
import type { Sql, TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import {
  deliverySlotUnavailableMessage,
  evaluateSlot,
  minutesOfDay,
  toTimeOfDay,
  type SlotRuleInput,
} from '../domain/delivery-slot-rules'
import { businessDate, businessMinutesOfDay } from '../time'

type Tx = TransactionSql<Record<string, unknown>>
/** Accepts the pool or an in-flight transaction: the same read is used by both. */
type Queryable = Sql<Record<string, unknown>> | Tx

/**
 * Statuses that occupy a delivery window. Everything except Cancelled counts: a pending order still
 * needs a courier on that run, so counting only confirmed orders would let the window be oversold
 * while the operator works through the queue. Cancelling therefore frees the seat immediately, which
 * differs from food capacity — that is a production counter consumed at confirmation.
 */
export const deliverySlotConsumingStatuses = [
  OrderStatus.PendingConfirmation,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.Ready,
  OrderStatus.Delivered,
] as const

type SlotRow = {
  id: number
  title: string
  startTime: string
  endTime: string
  sortOrder: number
  orderCutoffMinutesBeforeStart: number
  isActive: boolean
  overrideAvailable: boolean | null
  overrideCapacity: number | null
  usedOrders: number
}

/**
 * Every slot with its override and live usage for one date. One query so the customer view, the
 * order validator and the Admin day view all see the same numbers.
 */
async function selectSlotsForDate(tx: Queryable, deliveryDate: string): Promise<SlotRow[]> {
  return tx<SlotRow[]>`
    SELECT s.id, s.title, s.start_time AS "startTime", s.end_time AS "endTime",
           s.sort_order AS "sortOrder",
           s.order_cutoff_minutes_before_start AS "orderCutoffMinutesBeforeStart",
           s.is_active AS "isActive",
           a.is_available AS "overrideAvailable",
           a.capacity_orders AS "overrideCapacity",
           COALESCE(u.used, 0)::int AS "usedOrders"
    FROM delivery_time_slots s
    LEFT JOIN delivery_time_slot_availabilities a
      ON a.delivery_time_slot_id = s.id AND a.delivery_date = ${deliveryDate}
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS used
      FROM orders o
      WHERE o.delivery_time_slot_id = s.id
        AND o.delivery_date = ${deliveryDate}
        AND o.status <> ${OrderStatus.Cancelled}
    ) u ON true
    ORDER BY s.sort_order, s.start_time, s.id
  `
}

function toRuleInput(row: SlotRow): SlotRuleInput {
  return {
    isActiveGlobally: row.isActive,
    override: row.overrideAvailable === null
      ? null
      : { isAvailable: row.overrideAvailable, capacityOrders: row.overrideCapacity },
    startTime: row.startTime,
    orderCutoffMinutesBeforeStart: row.orderCutoffMinutesBeforeStart,
    usedOrders: row.usedOrders,
  }
}

/** Customer-facing availability for one delivery date. */
export async function getDeliverySlotOptions(deliveryDate: string): Promise<DeliverySlotOptionsDto> {
  const now = new Date()
  const today = businessDate(now)
  const nowMinutes = businessMinutesOfDay(now)
  const rows = await selectSlotsForDate(sqlClient, deliveryDate)
  return {
    deliveryDate,
    slots: rows
      // A slot switched off in master data is not useful context for a customer, unlike one that is
      // merely full or past its cutoff, so it is the one case that is hidden rather than disabled.
      .filter((row) => row.isActive)
      .map((row) => {
        const reason = evaluateSlot(
          toRuleInput(row), nowMinutes, deliveryDate === today, deliveryDate < today,
        )
        return {
          id: row.id,
          title: row.title,
          startTime: toTimeOfDay(row.startTime),
          endTime: toTimeOfDay(row.endTime),
          isAvailable: reason === null,
          unavailableReason: reason,
        }
      }),
  }
}

/**
 * Validates and claims a delivery window inside an in-flight order transaction, and returns the
 * snapshot to persist on the order.
 *
 * Overselling is prevented with a transaction advisory lock keyed on date+slot rather than
 * `SELECT ... FOR UPDATE`: capacity is a count of order rows that do not exist yet, so row locks
 * cannot block the concurrent insert. Two checkouts racing for the last seat serialise here, and the
 * lock is released when the transaction ends. This mirrors the advisory lock already used for order
 * numbering; no external lock service is involved.
 */
export async function reserveDeliverySlot(
  tx: Tx,
  slotId: number,
  deliveryDate: string,
  now: Date,
): Promise<{ slotId: number; title: string; startTime: string; endTime: string }> {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${`kafgir-delivery-${deliveryDate}-${slotId}`}))`
  const rows = await selectSlotsForDate(tx, deliveryDate)
  const row = rows.find((candidate) => candidate.id === slotId)
  if (!row) throw new AppError('بازه ارسال انتخابی یافت نشد.')
  const today = businessDate(now)
  const reason = evaluateSlot(
    toRuleInput(row), businessMinutesOfDay(now), deliveryDate === today, deliveryDate < today,
  )
  if (reason !== null) throw new AppError(deliverySlotUnavailableMessage(reason))
  return {
    slotId: row.id,
    title: row.title,
    startTime: row.startTime,
    endTime: row.endTime,
  }
}

/** True when the date has at least one selectable window; checkout uses this to explain an empty list. */
export async function hasSelectableDeliverySlot(deliveryDate: string): Promise<boolean> {
  const options = await getDeliverySlotOptions(deliveryDate)
  return options.slots.some((slot) => slot.isAvailable)
}

export async function listDeliveryTimeSlots(): Promise<AdminDeliveryTimeSlotDto[]> {
  const rows = await sqlClient<Omit<SlotRow, 'overrideAvailable' | 'overrideCapacity' | 'usedOrders'>[]>`
    SELECT id, title, start_time AS "startTime", end_time AS "endTime", sort_order AS "sortOrder",
           order_cutoff_minutes_before_start AS "orderCutoffMinutesBeforeStart", is_active AS "isActive"
    FROM delivery_time_slots
    ORDER BY sort_order, start_time, id
  `
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startTime: toTimeOfDay(row.startTime),
    endTime: toTimeOfDay(row.endTime),
    sortOrder: row.sortOrder,
    orderCutoffMinutesBeforeStart: row.orderCutoffMinutesBeforeStart,
    isActive: row.isActive,
  }))
}

/**
 * Overlap is rejected. Two windows covering the same minute would let one order be counted against a
 * capacity the kitchen never planned for, and the customer could not tell the two apart in the list.
 */
async function assertNoOverlap(tx: Tx, startTime: string, endTime: string, excludeId: number | null) {
  const clashes = await tx<{ title: string }[]>`
    SELECT title FROM delivery_time_slots
    WHERE start_time < ${endTime}::time AND end_time > ${startTime}::time
      AND (${excludeId}::int IS NULL OR id <> ${excludeId})
    LIMIT 1
  `
  if (clashes[0]) {
    throw new AppError(`این بازه با «${clashes[0].title}» هم‌پوشانی دارد.`)
  }
}

export async function createDeliveryTimeSlot(
  request: DeliveryTimeSlotWriteRequest,
): Promise<AdminDeliveryTimeSlotDto> {
  if (minutesOfDay(request.startTime) >= minutesOfDay(request.endTime)) {
    throw new AppError('ساعت پایان باید بعد از ساعت شروع باشد.')
  }
  const id = await sqlClient.begin(async (tx) => {
    await assertNoOverlap(tx, request.startTime, request.endTime, null)
    const rows = await tx<{ id: number }[]>`
      INSERT INTO delivery_time_slots
        (title, start_time, end_time, sort_order, order_cutoff_minutes_before_start, is_active, created_at)
      VALUES
        (${request.title}, ${request.startTime}::time, ${request.endTime}::time, ${request.sortOrder},
         ${request.orderCutoffMinutesBeforeStart}, ${request.isActive}, ${new Date().toISOString()})
      RETURNING id
    `
    return rows[0]!.id
  })
  const created = (await listDeliveryTimeSlots()).find((slot) => slot.id === id)
  if (!created) throw new NotFoundError()
  return created
}

export async function updateDeliveryTimeSlot(
  id: number,
  request: DeliveryTimeSlotWriteRequest,
): Promise<AdminDeliveryTimeSlotDto> {
  if (minutesOfDay(request.startTime) >= minutesOfDay(request.endTime)) {
    throw new AppError('ساعت پایان باید بعد از ساعت شروع باشد.')
  }
  await sqlClient.begin(async (tx) => {
    await assertNoOverlap(tx, request.startTime, request.endTime, id)
    const updated = await tx<{ id: number }[]>`
      UPDATE delivery_time_slots
      SET title = ${request.title}, start_time = ${request.startTime}::time,
          end_time = ${request.endTime}::time, sort_order = ${request.sortOrder},
          order_cutoff_minutes_before_start = ${request.orderCutoffMinutesBeforeStart},
          is_active = ${request.isActive}, updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING id
    `
    if (!updated[0]) throw new NotFoundError()
  })
  const slot = (await listDeliveryTimeSlots()).find((candidate) => candidate.id === id)
  if (!slot) throw new NotFoundError()
  return slot
}

export async function setDeliveryTimeSlotActive(id: number, isActive: boolean): Promise<void> {
  const rows = await sqlClient<{ id: number }[]>`
    UPDATE delivery_time_slots
    SET is_active = ${isActive}, updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows[0]) throw new NotFoundError()
}

/**
 * Admin's per-day view. `isAvailable` is the switch the operator toggles, while `unavailableReason`
 * runs the same rules the customer query runs, so the two apps can never disagree about whether a
 * window is actually pickable. Reporting only the switch made Admin show «فعال» for windows whose
 * cutoff had already passed, or whose master record was inactive.
 */
export async function getDeliveryDay(deliveryDate: string): Promise<AdminDeliveryDayDto> {
  const now = new Date()
  const today = businessDate(now)
  const nowMinutes = businessMinutesOfDay(now)
  const rows = await selectSlotsForDate(sqlClient, deliveryDate)
  return {
    deliveryDate,
    slots: rows.map((row) => ({
      slotId: row.id,
      title: row.title,
      startTime: toTimeOfDay(row.startTime),
      endTime: toTimeOfDay(row.endTime),
      sortOrder: row.sortOrder,
      isActiveGlobally: row.isActive,
      hasOverride: row.overrideAvailable !== null,
      isAvailable: row.overrideAvailable ?? row.isActive,
      unavailableReason: evaluateSlot(
        toRuleInput(row), nowMinutes, deliveryDate === today, deliveryDate < today,
      ),
      capacityOrders: row.overrideCapacity,
      usedOrders: row.usedOrders,
    })),
  }
}

/** Upsert keyed by the unique (date, slot) index, so a day can never hold two configurations. */
export async function setDeliveryDayOverride(request: DeliveryDayOverrideRequest): Promise<void> {
  const nowIso = new Date().toISOString()
  await sqlClient`
    INSERT INTO delivery_time_slot_availabilities
      (delivery_date, delivery_time_slot_id, is_available, capacity_orders, created_at)
    VALUES
      (${request.deliveryDate}, ${request.deliveryTimeSlotId}, ${request.isAvailable},
       ${request.capacityOrders}, ${nowIso})
    ON CONFLICT (delivery_date, delivery_time_slot_id) DO UPDATE
    SET is_available = EXCLUDED.is_available,
        capacity_orders = EXCLUDED.capacity_orders,
        updated_at = ${nowIso}
  `
}

export { DeliverySlotUnavailableReason }
