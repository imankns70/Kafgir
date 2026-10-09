import { sqlClient } from '../db/client'
import { logger } from '../logging/logger'

/**
 * A full, readable copy of the business data for safekeeping: every table in `public`, as rows of
 * JSON, plus the last applied migration so the copy says which schema it belongs to.
 *
 * Login secrets never leave the database: one-time codes and tokens are skipped entirely, and
 * password hashes, security stamps and encrypted channel credentials are dropped column by column.
 * A copy restored from this would need passwords reset — the price of a file that is safe to keep
 * on a laptop.
 */

const skippedTables = new Set(['customer_otp_challenges', 'user_tokens', 'user_logins'])
const redactedColumns = new Set([
  'users.password_hash', 'users.security_stamp', 'users.concurrency_stamp',
  'roles.concurrency_stamp', 'social_channels.credential_ciphertext',
])

export type DatabaseSnapshot = {
  format: 'kafgir-backup'
  version: 1
  exportedAt: string
  lastMigration: string | null
  redacted: string[]
  tables: Record<string, Record<string, unknown>[]>
}

/** Every public table, read in one read-only transaction so the copy is consistent. */
export async function exportDatabaseSnapshot(userId: number): Promise<DatabaseSnapshot> {
  const tables = await sqlClient<{ name: string }[]>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`
  const columns = await sqlClient<{ table: string; column: string }[]>`
    SELECT table_name AS table, column_name AS column FROM information_schema.columns
    WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  const migration = await sqlClient<{ hash: string | null; createdAt: string | null }[]>`
    SELECT hash, created_at::text AS "createdAt" FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`
    .catch(() => [])

  const snapshot: DatabaseSnapshot = {
    format: 'kafgir-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    lastMigration: migration[0]?.createdAt ?? null,
    redacted: [...skippedTables].map((table) => `${table} (جدول)`).concat([...redactedColumns]),
    tables: {},
  }
  // One consistent view of the data, even while orders keep arriving.
  await sqlClient.begin('ISOLATION LEVEL REPEATABLE READ READ ONLY', async (tx) => {
    for (const { name } of tables) {
      if (skippedTables.has(name)) continue
      const kept = columns.filter((column) => column.table === name && !redactedColumns.has(`${name}.${column.column}`))
      if (kept.length === 0) continue
      const list = kept.map((column) => `"${column.column.replace(/"/gu, '""')}"`).join(', ')
      const hasId = kept.some((column) => column.column === 'id')
      snapshot.tables[name] = await tx.unsafe(`SELECT ${list} FROM "${name.replace(/"/gu, '""')}"${hasId ? ' ORDER BY id' : ''}`) as Record<string, unknown>[]
    }
  })
  const rowCount = Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)
  await sqlClient`
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
    VALUES ('backup.export', 'settings', NULL, ${userId}, ${`${Object.keys(snapshot.tables).length} جدول، ${rowCount} سطر`}, NOW())`
  logger.info({ event: 'backup.export', userId, rowCount }, 'نسخه پشتیبان گرفته شد')
  return snapshot
}
