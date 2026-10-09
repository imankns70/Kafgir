import {
  buildInvoiceOrderLines,
  DeliveryMethod,
  OrderStatus,
  type PackingOrderDto,
  type PaymentMethod,
  type ProductionSheetDto,
  type LeftoverItemDto,
  type LeftoverWriteRequest,
} from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { orderServiceDate } from '../db/service-date'
import { AppError } from '../errors'

type LineRow = {
  orderId: number
  orderNumber: string
  status: OrderStatus
  customerFullName: string
  customerPhoneNumber: string
  deliveryMethod: DeliveryMethod
  address: string | null
  isExpress: boolean
  slotTitle: string | null
  startTime: string | null
  endTime: string | null
  paymentMethod: PaymentMethod
  totalAmount: number
  customerNote: string | null
  itemId: number
  dailyMenuItemId: number
  foodName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  isPersianRice: boolean
  allowsPersianRice: boolean
}

const riceSuffix = ' (با برنج ایرانی)'
const toCookStatuses = new Set([OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready])

const slotOf = (row: LineRow): { key: string; title: string } => {
  if (row.deliveryMethod === DeliveryMethod.Pickup) return { key: 'pickup', title: 'تحویل حضوری' }
  if (row.isExpress) return { key: 'express', title: 'ارسال فوری' }
  if (row.startTime && row.endTime) {
    return { key: `slot-${row.startTime}`, title: `${row.slotTitle ? `${row.slotTitle} · ` : ''}${row.startTime} تا ${row.endTime}` }
  }
  return { key: 'unscheduled', title: 'بدون بازه' }
}

/**
 * What the kitchen cooks and packs on one service day. Persian-rice add-ons are stored as their own
 * order lines; they are folded into the dish exactly as on the invoice, so the cook reads
 * «قورمه‌سبزی ۸ پرس، ۳ با برنج ایرانی» instead of a separate rice row to reconcile by hand.
 */
export async function getProductionSheet(date: string): Promise<ProductionSheetDto> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new AppError('تاریخ معتبر نیست.')
  const rows = await sqlClient<LineRow[]>`
    SELECT o.id AS "orderId", o.order_number AS "orderNumber", o.status,
           o.delivery_full_name AS "customerFullName", o.delivery_phone_number AS "customerPhoneNumber",
           o.delivery_method AS "deliveryMethod",
           NULLIF(TRIM(CONCAT_WS('، ', NULLIF(o.delivery_city, ''), NULLIF(o.delivery_address_line, ''))), '') AS address,
           o.is_express AS "isExpress", o.delivery_time_slot_title AS "slotTitle",
           to_char(o.delivery_start_time, 'HH24:MI') AS "startTime", to_char(o.delivery_end_time, 'HH24:MI') AS "endTime",
           o.payment_method AS "paymentMethod", o.total_amount::float8 AS "totalAmount",
           o.customer_note AS "customerNote",
           oi.id AS "itemId", oi.daily_menu_item_id AS "dailyMenuItemId", oi.food_name AS "foodName",
           oi.quantity, oi.unit_price::float8 AS "unitPrice", oi.total_price::float8 AS "totalPrice",
           f.is_persian_rice AS "isPersianRice", f.allows_persian_rice AS "allowsPersianRice"
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN daily_menu_items d ON d.id = oi.daily_menu_item_id
    JOIN foods f ON f.id = d.food_id
    WHERE ${orderServiceDate('o')} = ${date}::date AND o.status <> ${OrderStatus.Cancelled}
    ORDER BY o.delivery_start_time NULLS LAST, o.order_number, oi.id
  `

  const byOrder = new Map<number, LineRow[]>()
  for (const row of rows) byOrder.set(row.orderId, [...(byOrder.get(row.orderId) ?? []), row])

  const dishes = new Map<string, ProductionSheetDto['dishes'][number]>()
  const slots = new Map<string, ProductionSheetDto['slots'][number] & { sort: string }>()
  const orders: PackingOrderDto[] = []
  let persianRicePortions = 0

  for (const lines of byOrder.values()) {
    const head = lines[0]!
    const folded = buildInvoiceOrderLines(lines.map((line) => ({
      id: line.itemId, dailyMenuItemId: line.dailyMenuItemId, foodName: line.foodName,
      unitPrice: line.unitPrice, quantity: line.quantity, totalPrice: line.totalPrice,
      isPersianRice: line.isPersianRice, allowsPersianRice: line.allowsPersianRice,
    })))
    const packingLines = folded.map((line) => ({
      foodName: line.foodName.replace(riceSuffix, ''),
      quantity: line.quantity,
      withPersianRice: line.key.includes(':rice:'),
    }))
    const cooking = toCookStatuses.has(head.status)
    for (const line of packingLines) {
      const dish = dishes.get(line.foodName) ?? { foodName: line.foodName, toCook: 0, withPersianRice: 0, pending: 0, delivered: 0 }
      if (cooking) {
        dish.toCook += line.quantity
        if (line.withPersianRice) dish.withPersianRice += line.quantity
      } else if (head.status === OrderStatus.PendingConfirmation) dish.pending += line.quantity
      else if (head.status === OrderStatus.Delivered) dish.delivered += line.quantity
      dishes.set(line.foodName, dish)
      if (cooking && line.withPersianRice) persianRicePortions += line.quantity
    }
    const slot = slotOf(head)
    const sort = head.deliveryMethod === DeliveryMethod.Pickup ? 'z' : head.isExpress ? '0' : head.startTime ?? 'y'
    const bucket = slots.get(slot.key) ?? { ...slot, orders: 0, portions: 0, sort }
    if (head.status !== OrderStatus.Delivered) {
      bucket.orders += 1
      bucket.portions += packingLines.reduce((sum, line) => sum + line.quantity, 0)
    }
    slots.set(slot.key, bucket)
    orders.push({
      id: head.orderId,
      orderNumber: head.orderNumber,
      status: head.status,
      customerFullName: head.customerFullName,
      customerPhoneNumber: head.customerPhoneNumber,
      deliveryMethod: head.deliveryMethod,
      address: head.deliveryMethod === DeliveryMethod.Pickup ? null : head.address,
      slotKey: slot.key,
      slotTitle: slot.title,
      isExpress: head.isExpress,
      paymentMethod: head.paymentMethod,
      totalAmount: head.totalAmount,
      customerNote: head.customerNote,
      lines: packingLines,
    })
  }

  return {
    date,
    dishes: [...dishes.values()].sort((a, b) => b.toCook - a.toCook || a.foodName.localeCompare(b.foodName, 'fa')),
    persianRicePortions,
    slots: [...slots.values()].sort((a, b) => a.sort.localeCompare(b.sort)).map(({ sort: _sort, ...slot }) => slot),
    orders: orders.sort((a, b) =>
      slots.get(a.slotKey)!.sort.localeCompare(slots.get(b.slotKey)!.sort) || a.orderNumber.localeCompare(b.orderNumber)),
  }
}

type LeftoverRow = Omit<LeftoverItemDto, 'recordedAt'> & { recordedAt: Date | null }

/** The day's dishes with what is recorded as left over; empty when the day has no menu. */
export async function getLeftovers(date: string): Promise<LeftoverItemDto[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new AppError('تاریخ معتبر نیست.')
  const rows = await sqlClient<LeftoverRow[]>`
    SELECT i.id AS "dailyMenuItemId", f.name AS "foodName", i.capacity_portions AS "capacityPortions",
           i.sold_portions AS "soldPortions", i.leftover_portions AS "leftoverPortions",
           i.leftover_recorded_at AS "recordedAt"
    FROM daily_menu_items i
    JOIN daily_menus m ON m.id = i.daily_menu_id
    JOIN foods f ON f.id = i.food_id
    WHERE m.menu_date = ${date}::date
    ORDER BY f.is_persian_rice, f.name
  `
  return rows.map((row) => ({ ...row, recordedAt: row.recordedAt ? new Date(row.recordedAt).toISOString() : null }))
}

/** Saves the closing count. Only items of that day's menu are touched. */
export async function saveLeftovers(input: LeftoverWriteRequest, userId: number): Promise<LeftoverItemDto[]> {
  await sqlClient.begin(async (tx) => {
    for (const item of input.items) {
      const updated = await tx`
        UPDATE daily_menu_items i
        SET leftover_portions = ${item.leftoverPortions},
            leftover_recorded_at = CASE WHEN ${item.leftoverPortions}::int IS NULL THEN NULL ELSE NOW() END
        FROM daily_menus m
        WHERE i.id = ${item.dailyMenuItemId} AND m.id = i.daily_menu_id AND m.menu_date = ${input.date}::date
        RETURNING i.id`
      if (updated.length === 0) throw new AppError('یکی از غذاها در منوی این روز نیست.')
    }
    const total = input.items.reduce((sum, item) => sum + (item.leftoverPortions ?? 0), 0)
    await tx`
      INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
      VALUES ('menu.leftovers', 'menu', NULL, ${userId}, ${`${input.date}: ${total} پرس`}, NOW())`
  })
  return getLeftovers(input.date)
}
