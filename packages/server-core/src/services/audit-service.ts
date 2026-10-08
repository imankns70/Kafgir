import type { AuditLogEntryDto, PagedResult } from '@kafgir/contracts'
import { sqlClient } from '../db/client'
import { pagedResult, resolvePaging } from '../db/paginate'

/**
 * Who changed money and records, newest first. `audit_logs` has been written by purchases and
 * payments for a long time; this is the first screen that reads it, merged with the operator-stamped
 * order status history so one list answers "who did this?".
 */
export async function listAuditLogs(query: {
  entityType?: string | null
  search?: string | null
  page?: number
  pageSize?: number
}): Promise<PagedResult<AuditLogEntryDto>> {
  const paging = resolvePaging(query.page, query.pageSize)
  const entityType = query.entityType?.trim() || null
  const search = query.search?.trim() || null
  const rows = await sqlClient<Array<Omit<AuditLogEntryDto, 'createdAt'> & { createdAt: Date | string; totalCount: number }>>`
    WITH entries AS (
      SELECT 'audit-' || a.id AS key, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
             a.details, a.created_at AS "createdAt", NULLIF(TRIM(u.full_name), '') AS "userName",
             NULL::text AS "orderNumber"
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      UNION ALL
      SELECT 'order-' || h.id, 'order.status', 'order', h.order_id,
             h.from_status || '→' || h.to_status || COALESCE(' — ' || h.note, ''),
             h.changed_at, NULLIF(TRIM(u.full_name), ''), o.order_number
      FROM order_status_histories h
      JOIN orders o ON o.id = h.order_id
      LEFT JOIN users u ON u.id = h.changed_by_user_id
    )
    SELECT *, COUNT(*) OVER ()::int AS "totalCount"
    FROM entries
    WHERE (${entityType}::text IS NULL OR "entityType" = ${entityType})
      AND (${search}::text IS NULL
           OR action ILIKE '%' || ${search} || '%'
           OR COALESCE(details, '') ILIKE '%' || ${search} || '%'
           OR COALESCE("userName", '') ILIKE '%' || ${search} || '%'
           OR COALESCE("orderNumber", '') ILIKE '%' || ${search} || '%')
    ORDER BY "createdAt" DESC, key DESC
    LIMIT ${paging.limit} OFFSET ${paging.offset}
  `
  return pagedResult(
    rows.map(({ totalCount: _ignored, createdAt, ...row }) => ({
      ...row,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
    })),
    rows[0]?.totalCount ?? 0,
    paging,
  )
}
