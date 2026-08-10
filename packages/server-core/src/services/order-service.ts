import {
  DeliveryMethod,
  OrderStatus,
  type CreateOrderRequest,
  type OrderDto,
  type OrderReportQuery,
  type OrderSummaryDto,
  type UpdateOrderStatusRequest,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError, UnauthorizedError } from '../errors'
import { persianBusinessYear } from '../time'
import type { TelegramIdentity } from '../telegram/validation'
import { isAllowedOrderTransition, normalizePhone, optionalText } from '../domain/order-rules'
import { consumeOrderInventory, reverseOrderInventory } from './v15-service'
import { reserveDeliverySlot } from './delivery-slot-service'
import { logger } from '../logging/logger'
import { formatTelegramOrderInvoice } from '../domain/order-invoice'

const defaultCity = 'اندیمشک'
const customerRole = 'Customer'
type DbTimestamp = Date | string

const isoTimestamp = (value: DbTimestamp) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const nullableIsoTimestamp = (value: DbTimestamp | null) =>
  value ? isoTimestamp(value) : null
const sqlTimestamp = (value: Date) => value.toISOString()

type OrderRecord = {
  id: number
  orderNumber: string
  customerId: number
  customerFullName: string
  customerPhoneNumber: string
  addressLine: string | null
  status: OrderStatus
  paymentMethod: number
  deliveryMethod: number
  subtotalAmount: number
  deliveryFee: number
  totalAmount: number
  customerNote: string | null
  adminNote: string | null
  createdAt: DbTimestamp
  confirmedAt: DbTimestamp | null
  deliveredAt: DbTimestamp | null
  cancelledAt: DbTimestamp | null
  deliveryDate: string | null
  deliveryTimeSlotTitle: string | null
  deliveryStartTime: string | null
  deliveryEndTime: string | null
}

type OrderItemRecord = {
  id: number
  dailyMenuItemId: number
  foodName: string
  originalUnitPrice: number | null
  unitPrice: number
  quantity: number
  totalPrice: number
}

type HistoryRecord = {
  fromStatus: OrderStatus
  toStatus: OrderStatus
  note: string | null
  changedAt: DbTimestamp
}

async function resolveCustomer(
  tx: TransactionSql,
  identity: TelegramIdentity,
  fullName: string,
  phoneNumber: string,
  now: Date,
  authenticatedUserId?: number,
) {
  const nowSql = sqlTimestamp(now)
  const username = identity.userId ? `tg_${identity.userId}` : `phone_${phoneNumber.replace(/\D/g, '') || crypto.randomUUID()}`
  const existing = authenticatedUserId
    ? await tx<{ id: number; profileId: number | null }[]>`
        SELECT u.id, p.id AS "profileId"
        FROM users u
        LEFT JOIN customer_profiles p ON p.user_id = u.id
        WHERE u.id = ${authenticatedUserId} AND u.is_active = true
        LIMIT 1
      `
    : identity.userId
    ? await tx<{ id: number; profileId: number | null }[]>`
        SELECT u.id, p.id AS "profileId"
        FROM telegram_accounts t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN customer_profiles p ON p.user_id = u.id
        WHERE t.telegram_user_id = ${identity.userId}
        LIMIT 1
      `
    : await tx<{ id: number; profileId: number | null }[]>`
        SELECT u.id, p.id AS "profileId"
        FROM users u
        LEFT JOIN customer_profiles p ON p.user_id = u.id
        WHERE u.phone_number = ${phoneNumber} OR u.username = ${username}
        ORDER BY u.id
        LIMIT 1
      `
  let userId = existing[0]?.id
  let profileId = existing[0]?.profileId
  if (!userId) {
    const users = await tx<{ id: number }[]>`
      INSERT INTO users
        (username, normalized_username, phone_number, full_name, is_active, created_at,
         last_seen_at, last_order_at, email_confirmed, phone_number_confirmed,
         two_factor_enabled, lockout_enabled, access_failed_count, password_hash_scheme,
         allows_write_to_pm)
      VALUES
        (${username}, ${username.toUpperCase()}, ${phoneNumber}, ${fullName}, true, ${nowSql},
         ${nowSql}, ${nowSql}, false, false, false, true, 0, 'none', false)
      RETURNING id
    `
    userId = users[0]!.id
    const roleRows = await tx<{ id: number }[]>`
      INSERT INTO roles (name, normalized_name, concurrency_stamp)
      VALUES (${customerRole}, ${customerRole.toUpperCase()}, ${crypto.randomUUID()})
      ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
    await tx`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (${userId}, ${roleRows[0]!.id})
      ON CONFLICT DO NOTHING
    `
  } else {
    await tx`
      UPDATE users
      SET full_name = ${fullName},
          phone_number = CASE
            WHEN EXISTS(SELECT 1 FROM customer_login_phones WHERE user_id = ${userId})
              THEN phone_number
            ELSE ${phoneNumber}
          END,
          last_seen_at = ${nowSql}, last_order_at = ${nowSql}
      WHERE id = ${userId}
    `
  }

  if (identity.userId) {
    await tx`
      INSERT INTO telegram_accounts
        (user_id, telegram_user_id, username, first_name, last_name, language_code,
         allows_write_to_pm, chat_id, created_at, last_seen_at)
      VALUES
        (${userId}, ${identity.userId}, ${identity.username}, ${identity.firstName},
         ${identity.lastName}, NULL, false, ${String(identity.userId)}, ${nowSql}, ${nowSql})
      ON CONFLICT (telegram_user_id) DO UPDATE
        SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name, chat_id = EXCLUDED.chat_id,
            last_seen_at = EXCLUDED.last_seen_at
    `
  }

  if (!profileId) {
    const profiles = await tx<{ id: number }[]>`
      INSERT INTO customer_profiles
        (user_id, preferred_name, default_phone_number, created_at, last_order_at)
      VALUES (${userId}, ${fullName}, ${phoneNumber}, ${nowSql}, ${nowSql})
      RETURNING id
    `
    profileId = profiles[0]!.id
  } else {
    await tx`
      UPDATE customer_profiles
      SET preferred_name = ${fullName},
          default_phone_number = CASE
            WHEN EXISTS(SELECT 1 FROM customer_login_phones WHERE user_id = ${userId})
              THEN default_phone_number
            ELSE ${phoneNumber}
          END,
          last_order_at = ${nowSql}
      WHERE id = ${profileId}
    `
  }
  return { userId, profileId }
}

export async function createOrder(
  request: CreateOrderRequest,
  identity: TelegramIdentity,
  allowMissingTelegramIdentity = false,
  authenticatedUserId?: number,
  sendTelegramInvoice = false,
  analytics?: { visitorId: string; sessionId: string | null },
): Promise<OrderDto> {
  if (!allowMissingTelegramIdentity && !identity.userId && !authenticatedUserId) {
    throw new UnauthorizedError('برای ثبت سفارش وارد حساب خود شوید.')
  }
  const fullName = request.fullName.trim()
  const phoneNumber = normalizePhone(request.phoneNumber)
  if (request.deliveryMethod === DeliveryMethod.Delivery && !request.customerAddressId && !optionalText(request.addressLine)) {
    throw new AppError('برای سفارش ارسالی، انتخاب آدرس ذخیره‌شده یا وارد کردن آدرس الزامی است.')
  }
  if (new Set(request.items.map((item) => `${item.dailyMenuItemId}:${item.withPersianRice}`)).size !== request.items.length) {
    throw new AppError('هر غذا با و بدون برنج ایرانی فقط یک‌بار می‌تواند در اقلام سفارش ارسال شود.')
  }

  const createdId = await sqlClient.begin(async (tx) => {
    const now = new Date()
    const nowSql = sqlTimestamp(now)
    const customer = await resolveCustomer(tx, identity, fullName, phoneNumber, now, authenticatedUserId)
    let customerAddressId = request.customerAddressId ?? null
    let city = optionalText(request.city) ?? defaultCity
    let addressLine = optionalText(request.addressLine) ?? ''
    if (customerAddressId) {
      const addresses = await tx<{ id: number; city: string; addressLine: string }[]>`
        SELECT id, city, address_line AS "addressLine"
        FROM customer_addresses
        WHERE id = ${customerAddressId} AND customer_profile_id = ${customer.profileId} AND is_active = true
        LIMIT 1
      `
      const address = addresses[0]
      if (!address) throw new AppError('آدرس ذخیره‌شده انتخابی یافت نشد.')
      city = address.city
      addressLine = address.addressLine
      await tx`UPDATE customer_addresses SET last_used_at = ${nowSql} WHERE id = ${customerAddressId}`
    } else if (addressLine && request.saveAddress) {
      const hasDefault = await tx<{ value: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM customer_addresses
          WHERE customer_profile_id = ${customer.profileId} AND is_active = true AND is_default = true
        ) AS value
      `
      const inserted = await tx<{ id: number }[]>`
        INSERT INTO customer_addresses
          (customer_profile_id, title, city, address_line, is_default, is_active, created_at, last_used_at)
        VALUES
          (${customer.profileId}, ${optionalText(request.newAddressTitle) ?? 'آدرس جدید'}, ${city},
           ${addressLine}, ${!hasDefault[0]?.value}, true, ${nowSql}, ${nowSql})
        RETURNING id
      `
      customerAddressId = inserted[0]!.id
    }

    type MenuItemRecord = {
      id: number
      dailyMenuId: number
      name: string
      price: number
      originalPrice: number | null
      isAvailable: boolean
      isOpen: boolean
      remaining: number
      orderDeadline: Date | null
      foodIsActive: boolean
      allowsPersianRice: boolean
      isPersianRice: boolean
    }
    const selectMenuItem = (id: number) => tx<MenuItemRecord[]>`
      SELECT i.id, i.daily_menu_id AS "dailyMenuId", f.name,
             COALESCE(i.discount_price, i.price)::float8 AS price,
             CASE WHEN i.discount_price IS NOT NULL THEN i.price::float8 ELSE NULL END AS "originalPrice",
             i.is_available AS "isAvailable", m.is_open AS "isOpen",
             i.capacity_portions - i.sold_portions AS remaining,
             m.order_deadline AS "orderDeadline", f.is_active AS "foodIsActive",
             f.allows_persian_rice AS "allowsPersianRice",
             f.is_persian_rice AS "isPersianRice"
      FROM daily_menu_items i
      JOIN daily_menus m ON m.id = i.daily_menu_id
      JOIN foods f ON f.id = i.food_id
      WHERE i.id = ${id}
      LIMIT 1
    `
    const assertOrderable = (menuItem: MenuItemRecord | undefined): MenuItemRecord => {
      if (!menuItem) throw new AppError('یکی از غذاهای سبد دیگر در منوی امروز وجود ندارد.')
      if (!menuItem.foodIsActive) throw new AppError(`«${menuItem.name}» غیرفعال شده است.`)
      if (!menuItem.isAvailable) throw new AppError(`«${menuItem.name}» امروز قابل سفارش نیست.`)
      if (!menuItem.isOpen) throw new AppError('سفارش‌گیری منوی امروز بسته است.')
      if (menuItem.orderDeadline && menuItem.orderDeadline <= now) {
        throw new AppError('مهلت سفارش منوی امروز به پایان رسیده است.')
      }
      return menuItem
    }

    // Foreign rice is already inside every dish price. The Persian upgrade is an ordinary food, so the
    // client only says yes or no per dish and the server resolves, prices and aggregates it into one
    // extra order line.
    // One dish can arrive twice — once plain and once upgraded — and both carry the same dish price.
    // Capacity must therefore be checked on the combined total and the dish emitted as a single order
    // line; checking each variant alone let two 8-portion lines pass against a 10-portion dish.
    const dishes = new Map<number, { menuItem: MenuItemRecord; quantity: number }>()
    let persianRicePortions = 0
    for (const item of request.items) {
      const menuItem = assertOrderable((await selectMenuItem(item.dailyMenuItemId))[0])
      if (menuItem.isPersianRice) {
        throw new AppError(`«${menuItem.name}» فقط به‌عنوان افزودن به یک غذا قابل سفارش است.`)
      }
      if (item.withPersianRice && !menuItem.allowsPersianRice) {
        throw new AppError(`«${menuItem.name}» امکان افزودن برنج ایرانی ندارد.`)
      }
      const quantity = (dishes.get(menuItem.id)?.quantity ?? 0) + item.quantity
      if (quantity > menuItem.remaining) {
        throw new AppError(`از «${menuItem.name}» فقط ${menuItem.remaining} پرس باقی مانده است. سبد را به‌روزرسانی کنید.`)
      }
      if (item.withPersianRice) persianRicePortions += item.quantity
      dishes.set(menuItem.id, { menuItem, quantity })
    }

    // Delivery date is not client input: it is the date of the menu the items came from. That keeps
    // one date model (`daily_menus.menu_date`) and makes "today's menu delivered tomorrow"
    // unrepresentable. Mixing menus in one basket was already assumed impossible by the rice lookup
    // below; now it is enforced rather than assumed.
    const menuIds = new Set([...dishes.values()].map(({ menuItem }) => menuItem.dailyMenuId))
    if (menuIds.size > 1) {
      throw new AppError('اقلام سبد به روزهای مختلفی تعلق دارند و در یک سفارش ثبت نمی‌شوند.')
    }
    const deliveryMenuId = [...menuIds][0]!
    const menuDates = await tx<{ menuDate: string }[]>`
      SELECT menu_date::text AS "menuDate" FROM daily_menus WHERE id = ${deliveryMenuId} LIMIT 1
    `
    const deliveryDate = menuDates[0]?.menuDate ?? null
    let deliverySnapshot: Awaited<ReturnType<typeof reserveDeliverySlot>> | null = null
    if (request.deliveryTimeSlotId != null) {
      if (!deliveryDate) throw new AppError('تاریخ تحویل این سفارش مشخص نیست.')
      deliverySnapshot = await reserveDeliverySlot(tx, request.deliveryTimeSlotId, deliveryDate, now)
    }

    const orderLines = [...dishes.values()]
    if (persianRicePortions > 0) {
      const menuId = orderLines[0]!.menuItem.dailyMenuId
      const riceRows = await tx<{ id: number }[]>`
        SELECT i.id FROM daily_menu_items i
        JOIN foods f ON f.id = i.food_id
        WHERE i.daily_menu_id = ${menuId} AND f.is_persian_rice
        ORDER BY i.id LIMIT 1
      `
      if (!riceRows[0]) throw new AppError('برنج ایرانی امروز در منو موجود نیست.')
      const rice = assertOrderable((await selectMenuItem(riceRows[0].id))[0])
      if (persianRicePortions > rice.remaining) {
        throw new AppError(`از «${rice.name}» فقط ${rice.remaining} پرس باقی مانده است. سبد را به‌روزرسانی کنید.`)
      }
      orderLines.push({ menuItem: rice, quantity: persianRicePortions })
    }

    const year = String(persianBusinessYear(now))
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`kafgir-order-${year}`}))`
    // The offset MUST be cast to int. Bound untyped, PostgreSQL resolves the POSIX-regex overload
    // `substring(text FROM text)` instead of the positional one, so '14051' matched '5' and every
    // order in the year collapsed to the same counter value.
    const counters = await tx<{ value: number }[]>`
      SELECT COALESCE(MAX(
        CASE WHEN substring(order_number from ${year.length + 1}::int) ~ '^[0-9]+$'
          THEN substring(order_number from ${year.length + 1}::int)::int ELSE 0 END
      ), 0)::int AS value
      FROM orders
      WHERE order_number LIKE ${`${year}%`}
    `
    const orderNumber = `${year}${(counters[0]?.value ?? 0) + 1}`
    const subtotal = orderLines.reduce((sum, line) => sum + line.menuItem.price * line.quantity, 0)
    const orderRows = await tx<{ id: number }[]>`
      INSERT INTO orders
        (order_number, customer_profile_id, customer_address_id, delivery_full_name,
         delivery_phone_number, delivery_city, delivery_address_line,
         status, payment_method, delivery_method, subtotal_amount, delivery_fee,
         total_amount, customer_note, delivery_date, delivery_time_slot_id,
         delivery_time_slot_title, delivery_start_time, delivery_end_time, created_at,
         analytics_visitor_id, analytics_session_id)
      VALUES
        (${orderNumber}, ${customer.profileId}, ${customerAddressId}, ${fullName},
         ${phoneNumber}, ${city}, ${addressLine}, ${OrderStatus.PendingConfirmation},
         ${request.paymentMethod}, ${request.deliveryMethod}, ${subtotal}, 0,
         ${subtotal}, ${optionalText(request.customerNote)},
         ${deliverySnapshot ? deliveryDate : null}::date, ${deliverySnapshot?.slotId ?? null},
         ${deliverySnapshot?.title ?? null},
         ${deliverySnapshot?.startTime ?? null}::time,
         ${deliverySnapshot?.endTime ?? null}::time, ${nowSql},
         ${analytics?.visitorId ?? null}::uuid,
         (SELECT id FROM analytics_sessions
          WHERE id = ${analytics?.sessionId ?? null}::uuid
            AND visitor_id = ${analytics?.visitorId ?? null}::uuid LIMIT 1))
      RETURNING id
    `
    const orderId = orderRows[0]!.id
    for (const { menuItem, quantity } of orderLines) {
      await tx`
        INSERT INTO order_items
          (order_id, daily_menu_item_id, original_unit_price, food_name, unit_price, quantity, total_price)
        VALUES
          (${orderId}, ${menuItem.id}, ${menuItem.originalPrice}, ${menuItem.name}, ${menuItem.price},
           ${quantity}, ${menuItem.price * quantity})
      `
    }
    const adminChat = optionalText(process.env.TELEGRAM_ADMIN_CHAT_ID)
    if (adminChat) {
      await tx`
        INSERT INTO notification_messages
          (channel, type, status, target, text, order_id, order_number, retry_count, created_at)
        VALUES
          (1, 1, 1, ${adminChat},
           ${`سفارش جدید کفگیر\nشماره سفارش: ${orderNumber}\nمشتری: ${fullName}\nموبایل: ${phoneNumber}\nمبلغ: ${subtotal.toLocaleString('en-US')} تومان\nآدرس: ${city}، ${addressLine}`},
           ${orderId}, ${orderNumber}, 0, ${nowSql})
      `
    }
    if (sendTelegramInvoice) {
      const chats = await tx<{ chatId: string }[]>`
        SELECT chat_id AS "chatId"
        FROM telegram_accounts
        WHERE user_id = ${customer.userId} AND chat_id IS NOT NULL
        LIMIT 1
      `
      if (chats[0]?.chatId) {
        const invoiceText = formatTelegramOrderInvoice({
          orderNumber,
          createdAt: now,
          customerFullName: fullName,
          customerPhoneNumber: phoneNumber,
          addressLine: request.deliveryMethod === DeliveryMethod.Delivery ? `${city}، ${addressLine}` : null,
          deliveryMethod: request.deliveryMethod,
          paymentMethod: request.paymentMethod,
          subtotalAmount: subtotal,
          deliveryFee: 0,
          totalAmount: subtotal,
          items: orderLines.map(({ menuItem, quantity }) => ({
            foodName: menuItem.name,
            unitPrice: menuItem.price,
            quantity,
          })),
        })
        await tx`
          INSERT INTO notification_messages
            (channel, type, status, target, text, order_id, order_number, retry_count, created_at)
          VALUES
            (1, 3, 1, ${chats[0].chatId}, ${invoiceText}, ${orderId}, ${orderNumber}, 0, ${nowSql})
        `
      }
    }
    return orderId
  })
  const created = await getOrder(createdId)
  logger.info({
    event: 'order.created', orderId: createdId, orderNumber: created.orderNumber,
    customerId: created.customerId, totalAmount: created.totalAmount,
  }, 'سفارش ایجاد شد')
  return created
}

export async function getOrder(id: number): Promise<OrderDto> {
  const records = await sqlClient<OrderRecord[]>`
    SELECT id, order_number AS "orderNumber", customer_profile_id AS "customerId",
           delivery_full_name AS "customerFullName",
           delivery_phone_number AS "customerPhoneNumber",
           delivery_address_line AS "addressLine",
           status, payment_method AS "paymentMethod", delivery_method AS "deliveryMethod",
           subtotal_amount::float8 AS "subtotalAmount", delivery_fee::float8 AS "deliveryFee",
           total_amount::float8 AS "totalAmount", customer_note AS "customerNote",
           admin_note AS "adminNote", created_at AS "createdAt",
           confirmed_at AS "confirmedAt", delivered_at AS "deliveredAt",
           cancelled_at AS "cancelledAt",
           delivery_date::text AS "deliveryDate",
           delivery_time_slot_title AS "deliveryTimeSlotTitle",
           to_char(delivery_start_time, 'HH24:MI') AS "deliveryStartTime",
           to_char(delivery_end_time, 'HH24:MI') AS "deliveryEndTime"
    FROM orders WHERE id = ${id} LIMIT 1
  `
  const order = records[0]
  if (!order) throw new NotFoundError()
  const items = await sqlClient<OrderItemRecord[]>`
    SELECT id, daily_menu_item_id AS "dailyMenuItemId", food_name AS "foodName",
           original_unit_price::float8 AS "originalUnitPrice",
           unit_price::float8 AS "unitPrice", quantity, total_price::float8 AS "totalPrice"
    FROM order_items WHERE order_id = ${id} ORDER BY id
  `
  const histories = await sqlClient<HistoryRecord[]>`
    SELECT from_status AS "fromStatus", to_status AS "toStatus", note, changed_at AS "changedAt"
    FROM order_status_histories WHERE order_id = ${id} ORDER BY changed_at
  `
  return {
    ...order,
    createdAt: isoTimestamp(order.createdAt),
    confirmedAt: nullableIsoTimestamp(order.confirmedAt),
    deliveredAt: nullableIsoTimestamp(order.deliveredAt),
    cancelledAt: nullableIsoTimestamp(order.cancelledAt),
    items,
    statusHistories: histories.map((history) => ({
      ...history,
      changedAt: isoTimestamp(history.changedAt),
    })),
  }
}

export async function searchOrders(query: OrderReportQuery): Promise<OrderSummaryDto[]> {
  const status = query.status ?? null
  const deliveryMethod = query.deliveryMethod ?? null
  const paymentMethod = query.paymentMethod ?? null
  const orderNumber = optionalText(query.orderNumber)
  const customerName = optionalText(query.customerName)
  const phoneNumber = optionalText(query.phoneNumber)
  const foodName = optionalText(query.foodName)
  const rows = await sqlClient<Array<{
    id: number
    orderNumber: string
    customerFullName: string
    customerPhoneNumber: string
    status: OrderStatus
    totalAmount: number
    paymentMethod: number
    deliveryMethod: number
    createdAt: DbTimestamp
    totalQuantity: number
    foodSummary: string
    deliveryDate: string | null
    deliveryTimeSlotTitle: string | null
    deliveryStartTime: string | null
    deliveryEndTime: string | null
  }>>`
    SELECT o.id, o.order_number AS "orderNumber", o.delivery_full_name AS "customerFullName",
           o.delivery_phone_number AS "customerPhoneNumber", o.status,
           o.total_amount::float8 AS "totalAmount", o.payment_method AS "paymentMethod",
           o.delivery_method AS "deliveryMethod", o.created_at AS "createdAt",
           o.delivery_date::text AS "deliveryDate",
           o.delivery_time_slot_title AS "deliveryTimeSlotTitle",
           to_char(o.delivery_start_time, 'HH24:MI') AS "deliveryStartTime",
           to_char(o.delivery_end_time, 'HH24:MI') AS "deliveryEndTime",
           COALESCE(SUM(oi.quantity), 0)::int AS "totalQuantity",
           COALESCE(string_agg(oi.food_name || ' × ' || oi.quantity, '، ' ORDER BY oi.id), '') AS "foodSummary"
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.created_at >= (${query.date}::date AT TIME ZONE 'Asia/Tehran')
      AND o.created_at < ((${query.date}::date + 1) AT TIME ZONE 'Asia/Tehran')
      AND (${status}::int IS NULL OR o.status = ${status})
      AND (${deliveryMethod}::int IS NULL OR o.delivery_method = ${deliveryMethod})
      AND (${paymentMethod}::int IS NULL OR o.payment_method = ${paymentMethod})
      AND (${orderNumber}::text IS NULL OR o.order_number ILIKE '%' || ${orderNumber} || '%')
      AND (${customerName}::text IS NULL OR o.delivery_full_name ILIKE '%' || ${customerName} || '%')
      AND (${phoneNumber}::text IS NULL OR o.delivery_phone_number ILIKE '%' || ${phoneNumber} || '%')
      AND (${foodName}::text IS NULL OR EXISTS (
        SELECT 1 FROM order_items food_item
        WHERE food_item.order_id = o.id AND food_item.food_name ILIKE '%' || ${foodName} || '%'
      ))
    GROUP BY o.id
    -- Dispatch order for the kitchen: earliest delivery window first, with orders that carry no
    -- window (manual/legacy) last rather than sorted among today's runs.
    ORDER BY o.delivery_date NULLS LAST, o.delivery_start_time NULLS LAST, o.created_at DESC
  `
  return rows.map((row) => ({ ...row, createdAt: isoTimestamp(row.createdAt) }))
}

export async function updateOrderStatus(id: number, request: UpdateOrderStatusRequest, userId = 1): Promise<void> {
  await sqlClient.begin(async (tx) => {
    const orderRows = await tx<{ status: OrderStatus; orderNumber: string; customerProfileId: number }[]>`
      SELECT status, order_number AS "orderNumber", customer_profile_id AS "customerProfileId"
      FROM orders WHERE id = ${id} FOR UPDATE
    `
    const order = orderRows[0]
    if (!order) throw new NotFoundError()
    if (!isAllowedOrderTransition(order.status, request.newStatus)) {
      throw new AppError(`Order status cannot change from ${order.status} to ${request.newStatus}.`)
    }
    const now = new Date()
    const nowSql = sqlTimestamp(now)
    if (request.newStatus === OrderStatus.Confirmed) {
      // Rice lines are ordinary order items, so one capacity loop now covers dishes and rice alike.
      const items = await tx<{ id: number; foodName: string; quantity: number; remaining: number }[]>`
        SELECT d.id, oi.food_name AS "foodName", oi.quantity,
               d.capacity_portions - d.sold_portions AS remaining
        FROM order_items oi
        JOIN daily_menu_items d ON d.id = oi.daily_menu_item_id
        WHERE oi.order_id = ${id}
        FOR UPDATE OF d
      `
      const insufficient = items.find((item) => item.remaining < item.quantity)
      if (insufficient) {
        throw new AppError(`موجودی «${insufficient.foodName}» برای تأیید سفارش کافی نیست.`)
      }
      for (const item of items) {
        await tx`UPDATE daily_menu_items SET sold_portions = sold_portions + ${item.quantity} WHERE id = ${item.id}`
      }
      await consumeOrderInventory(tx, id, userId)
    }
    if (request.newStatus === OrderStatus.Cancelled &&
        [OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready].includes(order.status)) {
      await tx`
        UPDATE daily_menu_items d
        SET sold_portions = GREATEST(0, d.sold_portions - oi.quantity)
        FROM order_items oi
        WHERE oi.order_id = ${id} AND oi.daily_menu_item_id = d.id
      `
      await reverseOrderInventory(tx, id, userId)
    }
    await tx`
      UPDATE orders
      SET status = ${request.newStatus},
          admin_note = CASE WHEN ${request.adminNote ?? null}::text IS NULL
            THEN admin_note ELSE ${optionalText(request.adminNote)} END,
          confirmed_at = CASE WHEN ${request.newStatus} = ${OrderStatus.Confirmed} THEN ${nowSql} ELSE confirmed_at END,
          delivered_at = CASE WHEN ${request.newStatus} = ${OrderStatus.Delivered} THEN ${nowSql} ELSE delivered_at END,
          cancelled_at = CASE WHEN ${request.newStatus} = ${OrderStatus.Cancelled} THEN ${nowSql} ELSE cancelled_at END
      WHERE id = ${id}
    `
    await tx`
      INSERT INTO order_status_histories (order_id, from_status, to_status, note, changed_at)
      VALUES (${id}, ${order.status}, ${request.newStatus}, ${optionalText(request.statusNote)}, ${nowSql})
    `
    const chats = await tx<{ chatId: string }[]>`
      SELECT t.chat_id AS "chatId"
      FROM customer_profiles p
      JOIN telegram_accounts t ON t.user_id = p.user_id
      WHERE p.id = ${order.customerProfileId}
      LIMIT 1
    `
    if (chats[0]?.chatId) {
      const statusText: Record<number, string> = {
        [OrderStatus.Confirmed]: 'تایید شد',
        [OrderStatus.Preparing]: 'در حال آماده‌سازی است',
        [OrderStatus.Ready]: 'آماده تحویل است',
        [OrderStatus.Delivered]: 'تحویل داده شد',
        [OrderStatus.Cancelled]: 'لغو شد',
      }
      await tx`
        INSERT INTO notification_messages
          (channel, type, status, target, text, order_id, order_number, retry_count, created_at)
        VALUES
          (1, 2, 1, ${chats[0].chatId},
           ${`وضعیت سفارش شما در کفگیر تغییر کرد\nشماره سفارش: ${order.orderNumber}\nوضعیت: ${statusText[request.newStatus] ?? 'به‌روزرسانی شد'}`},
           ${id}, ${order.orderNumber}, 0, ${nowSql})
      `
    }
  })
  logger.info({ event: 'order.status.changed', orderId: id, userId, newStatus: request.newStatus }, 'وضعیت سفارش تغییر کرد')
}
