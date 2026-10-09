import {
  authenticateAdmin,
  closeDatabase,
  configureDatabase,
  createStaff,
  currentAdminRoles,
  exportDatabaseSnapshot,
  listStaff,
  resetStaffPassword,
  updateStaff,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
const tag = crypto.randomUUID().replace(/-/gu, '').slice(0, 10)

let sql: ReturnType<typeof postgres>
const createdIds: number[] = []
let bootstrapId = 0

integration.sequential('staff accounts', () => {
  beforeAll(async () => {
    if (!new URL(connectionString!).pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 3, prepare: false })
    await configureDatabase(connectionString!, 3)
    bootstrapId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`boot-${tag}`},${`BOOT-${tag}`},'راه‌انداز',true,NOW()) RETURNING id`)[0]!.id
    createdIds.push(bootstrapId)
  })

  afterAll(async () => {
    if (!sql) return
    for (const id of [...createdIds].reverse()) {
      await sql`DELETE FROM audit_logs WHERE user_id = ${id} OR (entity_type = 'staff' AND entity_id = ${id})`
      await sql`DELETE FROM user_roles WHERE user_id = ${id}`
      await sql`DELETE FROM users WHERE id = ${id}`
    }
    await sql.end()
    await closeDatabase()
  })

  it('creates an account that can sign in with its roles, and refuses a taken username', async () => {
    const owner = await createStaff({ username: `owner.${tag}`, fullName: 'مالک آزمون', password: 'owner-pass-1', roles: ['Owner'] }, bootstrapId)
    createdIds.push(owner.id)
    const kitchen = await createStaff({ username: `kitchen.${tag}`, fullName: 'آشپز آزمون', password: 'kitchen-pass-1', roles: ['KitchenAdmin'] }, owner.id)
    createdIds.push(kitchen.id)
    const principal = await authenticateAdmin({ username: `KITCHEN.${tag}`, password: 'kitchen-pass-1' })
    expect(principal.roles).toEqual(['KitchenAdmin'])
    expect((await listStaff()).map((user) => user.username)).toEqual(expect.arrayContaining([`owner.${tag}`, `kitchen.${tag}`]))
    await expect(createStaff({ username: `Kitchen.${tag}`, fullName: 'تکراری', password: 'whatever-1', roles: ['KitchenAdmin'] }, owner.id))
      .rejects.toThrow(/قبلاً/u)
  })

  it('changes roles, resets a password and ends a deactivated session', async () => {
    const [, owner, kitchen] = createdIds
    await updateStaff(kitchen!, { fullName: 'آشپز آزمون', roles: ['KitchenAdmin', 'OrderManager'], isActive: true }, owner!)
    expect(await currentAdminRoles(kitchen!)).toEqual(expect.arrayContaining(['KitchenAdmin', 'OrderManager']))

    await resetStaffPassword(kitchen!, { password: 'new-kitchen-pass' }, owner!)
    await expect(authenticateAdmin({ username: `kitchen.${tag}`, password: 'kitchen-pass-1' })).rejects.toThrow()
    await authenticateAdmin({ username: `kitchen.${tag}`, password: 'new-kitchen-pass' })

    await updateStaff(kitchen!, { fullName: 'آشپز آزمون', roles: ['KitchenAdmin'], isActive: false }, owner!)
    expect(await currentAdminRoles(kitchen!)).toBeNull()
    await expect(authenticateAdmin({ username: `kitchen.${tag}`, password: 'new-kitchen-pass' })).rejects.toThrow()
  })

  it('never lets an owner lock themselves out', async () => {
    const [, owner] = createdIds
    await expect(updateStaff(owner!, { fullName: 'مالک آزمون', roles: ['Owner'], isActive: false }, owner!))
      .rejects.toThrow(/خودتان/u)
    await expect(updateStaff(owner!, { fullName: 'مالک آزمون', roles: ['OrderManager'], isActive: true }, owner!))
      .rejects.toThrow(/خودتان/u)
  })

  it('exports every business table but never a login secret', async () => {
    const snapshot = await exportDatabaseSnapshot(createdIds[0]!)
    expect(snapshot.format).toBe('kafgir-backup')
    expect(snapshot.tables).toHaveProperty('orders')
    expect(snapshot.tables).toHaveProperty('payments')
    expect(snapshot.tables).not.toHaveProperty('customer_otp_challenges')
    const owner = snapshot.tables.users!.find((row) => row.username === `owner.${tag}`)
    expect(owner).toBeDefined()
    expect(owner).not.toHaveProperty('password_hash')
    expect(owner).not.toHaveProperty('security_stamp')
    expect(JSON.stringify(snapshot)).not.toContain('scrypt$')
  })
})
