import { sqlClient } from './client'

/**
 * Tables introduced by the reference-data migration (`0021_striped_thunderbolt_ross.sql`).
 *
 * Electron Admin and the web app each read `DATABASE_URL` from their own workspace-local `.env.local`
 * file. Nothing keeps those two values in sync, so it is possible to run `db:migrate` against one
 * database while the app actually connects to another that never received the migration — the
 * symptom is a raw `PostgresError: relation "food_tag_groups" does not exist` surfacing from deep
 * inside a specific screen, which reads like a code defect rather than a stale database.
 *
 * This check runs once when Electron connects and turns that into an actionable message. It is
 * deliberately a short, explicit list rather than a generic "diff against the migration journal"
 * mechanism: the packaged Electron build does not ship the `apps/web/drizzle` folder (see
 * `apps/admin/package.json` `build.files`), so there is no bundled manifest to compare against at
 * runtime, and inventing one for a single known incident would be more machinery than the problem
 * warrants. Extend this list if a future migration introduces a table Electron depends on directly.
 */
export const referenceDataTables = [
  'food_tag_groups',
  'support_subjects',
  'payment_method_settings',
  'delivery_method_settings',
  // Added by `0023_courier_delivery_accounting.sql`. Electron's courier pages read these directly,
  // and an unmigrated database would otherwise fail deep inside a screen rather than at connect.
  'couriers',
  'courier_delivery_days',
  'courier_settlements',
] as const

/** Which of `tableNames` are absent from the connected database's `public` schema. */
export async function findMissingTables(tableNames: readonly string[]): Promise<string[]> {
  if (tableNames.length === 0) return []
  const rows = await sqlClient<{ tableName: string }[]>`
    SELECT table_name AS "tableName" FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${tableNames})
  `
  const present = new Set(rows.map((row) => row.tableName))
  return tableNames.filter((name) => !present.has(name))
}

/** Renders the operator-facing explanation for a set of missing tables, or `null` when none are missing. */
export function missingTablesMessage(missing: readonly string[]): string | null {
  if (missing.length === 0) return null
  return `پایگاه داده پیکربندی‌شده به migrationهای اخیر به‌روزرسانی نشده است. جدول‌های یافت‌نشده: ${missing.join('، ')}. ` +
    'دستور «npm run db:migrate» را روی همان DATABASE_URL که این برنامه به آن متصل است اجرا کنید.'
}

/** Fails fast with a clear message when the connected database predates the reference-data migration. */
export async function assertReferenceDataSchemaReady(): Promise<void> {
  const message = missingTablesMessage(await findMissingTables(referenceDataTables))
  if (message) throw new Error(message)
}
