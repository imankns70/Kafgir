import type { AuditLogEntryDto } from '@kafgir/contracts'
import { OrderStatus } from '@kafgir/contracts'
import { adminApi } from './api'
import { Message, PageFrame, Pager, RowNumberCell, RowNumberHead, useServerPagedGrid } from './admin-ui'
import { formatPersianDateTime } from './number-format'

/**
 * Who changed money and orders. Purchases and payments have written `audit_logs` for a long time;
 * order status changes now carry their operator too. This page is the first place either is read.
 */

const actionLabel: Record<string, string> = {
  'order.status': 'تغییر وضعیت سفارش',
  'order.edit': 'ویرایش سفارش',
  'payment.create': 'ثبت پرداخت',
  'payment.status': 'تغییر وضعیت پرداخت',
  'payment.refund': 'استرداد',
  'purchase.create': 'ثبت خرید',
  'purchase.update': 'ویرایش خرید',
  'purchase.delete': 'حذف خرید',
}

const entityLabel: Record<string, string> = { order: 'سفارش', payment: 'پرداخت', purchase: 'خرید' }

const orderStatusLabel: Record<number, string> = {
  [OrderStatus.PendingConfirmation]: 'در انتظار تأیید',
  [OrderStatus.Confirmed]: 'تأییدشده',
  [OrderStatus.Preparing]: 'در حال آماده‌سازی',
  [OrderStatus.Ready]: 'آماده تحویل',
  [OrderStatus.Delivered]: 'تحویل‌شده',
  [OrderStatus.Cancelled]: 'لغوشده',
}

/** «3→6 — note» becomes «آماده‌سازی ← لغوشده — note» for order rows. */
export function describeAuditDetails(entry: Pick<AuditLogEntryDto, 'action' | 'details'>): string {
  if (!entry.details) return '—'
  if (entry.action !== 'order.status') return entry.details
  const match = /^(\d+)→(\d+)(.*)$/u.exec(entry.details)
  if (!match) return entry.details
  const [, from, to, rest] = match
  return `${orderStatusLabel[Number(from)] ?? from} ← ${orderStatusLabel[Number(to)] ?? to}${rest ?? ''}`
}

type Filters = { entityType?: string | null; search?: string | null }

export function AuditLogPage() {
  const paged = useServerPagedGrid<AuditLogEntryDto, Filters>(
    ({ page, pageSize, entityType, search }) => adminApi.auditLog({ page, pageSize, entityType, search }),
    { entityType: null, search: '' },
  )
  return <PageFrame title="گزارش تغییرات" description="چه کسی، کی، چه چیزی را در سفارش‌ها، پرداخت‌ها و خریدها تغییر داد.">
    <section className="toolbar">
      <label>نوع<select value={paged.filters.entityType ?? ''}
        onChange={(event) => paged.setFilters({ entityType: event.target.value || null })}>
        <option value="">همه</option>
        {Object.entries(entityLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label style={{ flex: 1 }}>جستجو<input placeholder="شماره سفارش، کاربر یا توضیح…" value={paged.filters.search ?? ''}
        onChange={(event) => paged.setFilters({ search: event.target.value })} /></label>
    </section>
    <Message error={paged.error} />
    <section className="panel compact-grid-panel">
      {paged.visible.length === 0
        ? <p className="list-state">{paged.loading ? 'در حال دریافت…' : 'تغییری ثبت نشده است.'}</p>
        : <><div className="table-wrap"><table>
            <thead><tr><RowNumberHead /><th>زمان</th><th>کاربر</th><th>عملیات</th><th>مورد</th><th>جزئیات</th></tr></thead>
            <tbody>{paged.visible.map((entry, index) => <tr key={entry.key}>
              <RowNumberCell offset={paged.rowOffset} index={index} />
              <td>{formatPersianDateTime(entry.createdAt)}</td>
              <td>{entry.userName ?? '—'}</td>
              <td>{actionLabel[entry.action] ?? entry.action}</td>
              <td>{entityLabel[entry.entityType] ?? entry.entityType} {entry.orderNumber
                ? <bdi dir="ltr">{entry.orderNumber}</bdi> : entry.entityId != null ? `#${entry.entityId}` : ''}</td>
              <td className="text-cell">{describeAuditDetails(entry)}</td>
            </tr>)}</tbody>
          </table></div><Pager {...paged} /></>}
    </section>
  </PageFrame>
}
