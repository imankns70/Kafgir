import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@kafgir/contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listAdminOrderReviews } from '@kafgir/server-core'
import {
  getCustomerOrderDetail,
  getPendingOrderReview,
  listCustomerOrderCards,
  saveCustomerOrderReview,
} from '../services/customer-order-service'

const connectionString = process.env.TEST_DATABASE_URL
const canRun = Boolean(connectionString && process.env.DATABASE_URL === connectionString)
const integration = describe.skipIf(!canRun)
let sql: ReturnType<typeof postgres>
const suffix = crypto.randomUUID()
let firstUserId = 0
let secondUserId = 0
let firstProfileId = 0
let pendingOrderId = 0
let deliveredOrderId = 0
let cancelledOrderId = 0
let financialAccountId = 0

integration('customer authentication, order ownership and reviews', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) throw new Error('Customer auth tests require a test database.')
    sql = postgres(connectionString!, { max: 2, prepare: false })

    const users = await sql<{ id: number }[]>`
      INSERT INTO users
        (username, normalized_username, full_name, is_active, created_at, email_confirmed,
         phone_number_confirmed, two_factor_enabled, lockout_enabled, access_failed_count,
         password_hash_scheme, allows_write_to_pm)
      VALUES
        (${`auth-a-${suffix}`}, ${`AUTH-A-${suffix}`}, 'Customer A', true, NOW(), false, true, false, true, 0, 'none', false),
        (${`auth-b-${suffix}`}, ${`AUTH-B-${suffix}`}, 'Customer B', true, NOW(), false, true, false, true, 0, 'none', false)
      RETURNING id
    `
    firstUserId = users[0]!.id
    secondUserId = users[1]!.id

    const profiles = await sql<{ id: number; userId: number }[]>`
      INSERT INTO customer_profiles
        (user_id, preferred_name, default_phone_number, created_at)
      VALUES
        (${firstUserId}, 'Customer A', '09120000001', NOW()),
        (${secondUserId}, 'Customer B', '09120000002', NOW())
      RETURNING id, user_id AS "userId"
    `
    firstProfileId = profiles.find((profile) => profile.userId === firstUserId)!.id

    await sql`
      INSERT INTO customer_login_phones
        (user_id, normalized_phone_number, verified_at, created_at, updated_at)
      VALUES
        (${firstUserId}, '09120000001', NOW(), NOW(), NOW()),
        (${secondUserId}, '09120000002', NOW(), NOW(), NOW())
    `
    await sql`
      INSERT INTO customer_addresses
        (customer_profile_id, title, city, address_line, is_default, is_active, created_at)
      VALUES (${firstProfileId}, 'خانه جدید', 'اهواز', 'نشانی جدید مشتری', true, true, NOW())
    `

    const orders = await sql<{ id: number; status: number }[]>`
      INSERT INTO orders
        (order_number, customer_profile_id, delivery_full_name, delivery_phone_number,
         delivery_city, delivery_address_line, status, payment_method, delivery_method,
         subtotal_amount, delivery_fee, total_amount, created_at, delivered_at, cancelled_at)
      VALUES
        (${`P-${suffix}`}, ${firstProfileId}, 'Customer A', '09120000001',
         'اندیمشک', 'نشانی زمان ثبت سفارش', ${OrderStatus.PendingConfirmation}, ${PaymentMethod.Cash}, 1,
         100, 0, 100, NOW() - INTERVAL '1 hour', NULL, NULL),
        (${`D-${suffix}`}, ${firstProfileId}, 'Customer A', '09120000001',
         'اندیمشک', 'نشانی تحویل‌شده', ${OrderStatus.Delivered}, ${PaymentMethod.Online}, 1,
         480000, 5000, 485000, NOW() - INTERVAL '3 day', NOW() - INTERVAL '2 day', NULL),
        (${`C-${suffix}`}, ${firstProfileId}, 'Customer A', '09120000001',
         'اندیمشک', 'نشانی لغوشده', ${OrderStatus.Cancelled}, ${PaymentMethod.Cash}, 1,
         200, 0, 200, NOW() - INTERVAL '5 day', NULL, NOW() - INTERVAL '4 day')
      RETURNING id, status
    `
    pendingOrderId = orders.find((order) => order.status === OrderStatus.PendingConfirmation)!.id
    deliveredOrderId = orders.find((order) => order.status === OrderStatus.Delivered)!.id
    cancelledOrderId = orders.find((order) => order.status === OrderStatus.Cancelled)!.id

    await sql`
      INSERT INTO order_status_histories (order_id, from_status, to_status, note, changed_at)
      VALUES
        (${deliveredOrderId}, ${OrderStatus.PendingConfirmation}, ${OrderStatus.Confirmed}, NULL, NOW() - INTERVAL '70 hour'),
        (${deliveredOrderId}, ${OrderStatus.Confirmed}, ${OrderStatus.Delivered}, 'تحویل به مشتری', NOW() - INTERVAL '48 hour')
    `

    const accounts = await sql<{ id: number }[]>`
      INSERT INTO financial_accounts
        (name, type, bank_name, opening_balance, is_active, created_at, updated_at)
      VALUES (${`gateway-${suffix}`}, 2, 'درگاه آزمایشی', 0, true, NOW(), NOW())
      RETURNING id
    `
    financialAccountId = accounts[0]!.id
    await sql`
      INSERT INTO payments
        (order_id, payment_method, financial_account_id, amount, status,
         tracking_number, reference_number, receipt_image_url, description,
         paid_at, created_at, updated_at)
      VALUES
        (${deliveredOrderId}, ${PaymentMethod.Online}, ${financialAccountId}, 485000,
         ${PaymentStatus.Paid}, 'TRACK-SAFE', 'REF-SAFE', 'https://private.invalid/receipt.jpg',
         'internal gateway payload must stay private', NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day', NOW())
    `
  })

  afterAll(async () => {
    if (!sql) return
    if (deliveredOrderId) await sql`DELETE FROM payments WHERE order_id = ${deliveredOrderId}`
    if (pendingOrderId || deliveredOrderId || cancelledOrderId) {
      await sql`DELETE FROM orders WHERE id IN (${pendingOrderId}, ${deliveredOrderId}, ${cancelledOrderId})`
    }
    if (financialAccountId) await sql`DELETE FROM financial_accounts WHERE id = ${financialAccountId}`
    if (firstUserId || secondUserId) await sql`DELETE FROM users WHERE id IN (${firstUserId}, ${secondUserId})`
    await sql.end()
  })

  it('lists only the authenticated customer orders with persisted totals and address snapshots', async () => {
    const first = await listCustomerOrderCards(firstUserId, 1)
    const second = await listCustomerOrderCards(secondUserId, 1)
    expect(first.items.map((item) => item.id)).toEqual(expect.arrayContaining([
      pendingOrderId,
      deliveredOrderId,
      cancelledOrderId,
    ]))
    expect(second.items).toHaveLength(0)
    expect(first.items[0]?.id).toBe(pendingOrderId)
    expect(first.items.find((item) => item.id === deliveredOrderId)).toMatchObject({
      totalAmount: 485000,
      deliveryCity: 'اندیمشک',
      addressLine: 'نشانی تحویل‌شده',
      paymentStatus: PaymentStatus.Paid,
    })
  })

  it('returns only actual status history and keeps payment status separate from order status', async () => {
    const detail = await getCustomerOrderDetail(firstUserId, deliveredOrderId)
    expect(detail.status).toBe(OrderStatus.Delivered)
    expect(detail.statusHistories.map((history) => history.toStatus)).toEqual([
      OrderStatus.Confirmed,
      OrderStatus.Delivered,
    ])
    expect(detail.payments[0]).toMatchObject({
      paymentMethod: PaymentMethod.Online,
      status: PaymentStatus.Paid,
      amount: 485000,
      providerName: 'درگاه آزمایشی',
      trackingNumber: 'TRACK-SAFE',
      referenceNumber: 'REF-SAFE',
    })
    expect(detail.payments[0]).not.toHaveProperty('financialAccountId')
    expect(detail.payments[0]).not.toHaveProperty('receiptImageUrl')
    expect(detail.payments[0]).not.toHaveProperty('description')
  })

  it('rejects another customer order detail without revealing its existence', async () => {
    await expect(getCustomerOrderDetail(secondUserId, deliveredOrderId)).rejects.toMatchObject({ status: 404 })
  })

  it('creates and edits one review for a delivered order without duplicates', async () => {
    const created = await saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 5, comment: 'عالی بود' })
    const updated = await saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 4, comment: 'خوب بود' })
    const count = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM order_reviews WHERE order_id = ${deliveredOrderId}
    `
    expect(updated.id).toBe(created.id)
    expect(updated).toMatchObject({ rating: 4, comment: 'خوب بود' })
    expect(count[0]?.count).toBe(1)
    await expect(getCustomerOrderDetail(firstUserId, deliveredOrderId)).resolves.toMatchObject({
      review: { id: created.id, rating: 4 },
    })
  })

  it('rejects reviews for active, cancelled, and another customer orders', async () => {
    await expect(saveCustomerOrderReview(firstUserId, pendingOrderId, { rating: 5 }))
      .rejects.toMatchObject({ status: 400 })
    await expect(saveCustomerOrderReview(firstUserId, cancelledOrderId, { rating: 5 }))
      .rejects.toMatchObject({ status: 400 })
    await expect(saveCustomerOrderReview(secondUserId, deliveredOrderId, { rating: 5 }))
      .rejects.toMatchObject({ status: 404 })
  })

  /**
   * The lookup behind the post-delivery prompt. These run in order: the first asserts the
   * delivered order is offered, the last asserts rating it clears the prompt.
   */
  it('offers a delivered unrated order as the pending rating', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    await expect(getPendingOrderReview(firstUserId)).resolves.toMatchObject({ orderId: deliveredOrderId })
  })

  it('does not offer pending or cancelled orders for rating', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    // Only the delivered order may be offered, never the pending or cancelled ones beside it.
    const pending = await getPendingOrderReview(firstUserId)
    expect(pending?.orderId).toBe(deliveredOrderId)
    expect([pendingOrderId, cancelledOrderId]).not.toContain(pending?.orderId)
  })

  it('offers nothing to a customer with no delivered orders', async () => {
    await expect(getPendingOrderReview(secondUserId)).resolves.toBeNull()
  })

  it('stops offering an order once it has been rated', async () => {
    await saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 5, comment: null })
    await expect(getPendingOrderReview(firstUserId)).resolves.toBeNull()
  })

  it('does not create a review merely by looking up the pending rating', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    await getPendingOrderReview(firstUserId)
    const count = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM order_reviews WHERE order_id = ${deliveredOrderId}
    `
    expect(count[0]?.count).toBe(0)
  })

  it('keeps a single review when the same rating is submitted concurrently', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    // Double-clicking submit, or a retried request, must not race two rows past the unique index.
    await Promise.all([
      saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 4, comment: null }),
      saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 4, comment: null }),
    ])
    const count = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM order_reviews WHERE order_id = ${deliveredOrderId}
    `
    expect(count[0]?.count).toBe(1)
  })

  it('accepts a rating without a comment and rejects an out-of-range rating', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    await expect(saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 3 }))
      .resolves.toMatchObject({ rating: 3, comment: null })
    // The database check constraint is the backstop behind the Zod schema.
    await expect(sql`
      INSERT INTO order_reviews (order_id, customer_profile_id, rating, created_at)
      VALUES (${pendingOrderId}, ${firstProfileId}, 9, NOW())
    `).rejects.toMatchObject({ code: '23514' })
  })

  it('surfaces a submitted review in the admin grid and narrows it by filter', async () => {
    await sql`DELETE FROM order_reviews WHERE order_id = ${deliveredOrderId}`
    await saveCustomerOrderReview(firstUserId, deliveredOrderId, { rating: 5, comment: 'عالی' })
    const page = await listAdminOrderReviews({ page: 1, pageSize: 10 })
    expect(page.items.some((review) => review.orderId === deliveredOrderId)).toBe(true)
    // The filter must narrow the reported total, not merely the rows on screen.
    const lowOnly = await listAdminOrderReviews({ rating: 1, page: 1, pageSize: 10 })
    expect(lowOnly.totalItems).toBeLessThan(page.totalItems)
  })

  it('enforces one account per verified phone', async () => {
    await expect(sql`
      INSERT INTO customer_login_phones
        (user_id, normalized_phone_number, verified_at, created_at, updated_at)
      VALUES (${secondUserId}, '09120000001', NOW(), NOW(), NOW())
    `).rejects.toMatchObject({ code: '23505' })
  })
})
