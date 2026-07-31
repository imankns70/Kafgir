import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getCustomerOrder, listCustomerOrders } from '../services/customer-service'

const connectionString = process.env.TEST_DATABASE_URL
const canRun = Boolean(connectionString && process.env.DATABASE_URL === connectionString)
const integration = describe.skipIf(!canRun)
let sql: ReturnType<typeof postgres>
const suffix = crypto.randomUUID()
let firstUserId = 0
let secondUserId = 0
let firstProfileId = 0
let orderId = 0

integration('customer authentication and order ownership', () => {
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
    const orders = await sql<{ id: number }[]>`
      INSERT INTO orders
        (order_number, customer_profile_id, delivery_full_name, delivery_phone_number,
         delivery_city, delivery_address_line, status, payment_method, delivery_method,
         subtotal_amount, delivery_fee, total_amount, created_at)
      VALUES
        (${`AUTH-${suffix}`}, ${firstProfileId}, 'Customer A', '09120000001',
         'اندیمشک', 'Test', 1, 2, 1, 100, 0, 100, NOW())
      RETURNING id
    `
    orderId = orders[0]!.id
  })

  afterAll(async () => {
    if (!sql) return
    if (orderId) await sql`DELETE FROM orders WHERE id = ${orderId}`
    if (firstUserId || secondUserId) {
      await sql`DELETE FROM users WHERE id IN (${firstUserId}, ${secondUserId})`
    }
    await sql.end()
  })

  it('lists only the authenticated customer profile orders', async () => {
    const first = await listCustomerOrders(firstUserId, 1)
    const second = await listCustomerOrders(secondUserId, 1)
    expect(first.items.map((item) => item.id)).toContain(orderId)
    expect(second.items.map((item) => item.id)).not.toContain(orderId)
  })

  it('rejects another customer order detail', async () => {
    await expect(getCustomerOrder(firstUserId, orderId)).resolves.toMatchObject({ id: orderId })
    await expect(getCustomerOrder(secondUserId, orderId)).rejects.toMatchObject({ status: 404 })
  })

  it('enforces one account per verified phone', async () => {
    await expect(sql`
      INSERT INTO customer_login_phones
        (user_id, normalized_phone_number, verified_at, created_at, updated_at)
      VALUES (${secondUserId}, '09120000001', NOW(), NOW(), NOW())
    `).rejects.toMatchObject({ code: '23505' })
  })
})
