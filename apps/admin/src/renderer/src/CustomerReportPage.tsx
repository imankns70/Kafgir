import { useCallback, useEffect, useState } from 'react'
import type { CustomerReportDto } from '@kafgir/contracts'
import { adminApi } from './api'
import {
  DateField, ListState, Message, PageFrame, Pager, RowNumberCell, RowNumberHead, useAsyncAction, usePagination,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate, formatPersianDateTime } from './number-format'

/**
 * Who buys from Kafgir, how often, and how much.
 *
 * The two money rules are printed on the screen rather than left implicit: revenue counts delivered
 * orders only, and order counts exclude cancellations. Without that note the totals here look wrong
 * next to the financial report, which counts recorded payments rather than order value.
 */

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const daysAgo = (days: number) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(Date.now() - days * 86_400_000))

const channelLabel = { telegram: 'تلگرام', phone: 'موبایل' } as const

export function CustomerReportPage() {
  // Defaults to the last 30 days: a single day rarely says anything useful about a customer base.
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [data, setData] = useState<CustomerReportDto | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reportAction = useAsyncAction()
  const paged = usePagination(data?.topCustomers ?? [])

  const load = useCallback(async (rangeFrom: string, rangeTo: string) => {
    try {
      setData(await adminApi.customerReport(rangeFrom, rangeTo))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setLoaded(true) }
  }, [])

  useEffect(() => { void reportAction.run(() => load(from, to)) }, [])

  const show = () => {
    if (from > to) { setError('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.'); return }
    void reportAction.run(() => load(from, to))
  }

  const summary = data?.summary
  const cards: Array<[string, string]> = summary ? [
    ['کل مشتریان', formatNumber(summary.totalCustomers)],
    ['مشتری جدید در بازه', formatNumber(summary.newCustomers)],
    ['مشتری فعال در بازه', formatNumber(summary.activeCustomers)],
    ['مشتری بازگشتی', formatNumber(summary.returningCustomers)],
    ['بدون سفارش', formatNumber(summary.customersWithoutOrders)],
    ['فروش تحویل‌شده', formatMoney(summary.totalRevenue)],
    ['میانگین سبد', formatMoney(summary.averageOrderValue)],
    ['سفارش به ازای مشتری فعال', formatNumber(summary.averageOrdersPerActiveCustomer)],
  ] : []

  return <PageFrame
    title="گزارش مشتریان"
    description="ترکیب مشتریان، مشتری‌های تازه و بازگشتی، و پرخریدترین‌ها در بازه انتخابی."
  >
    <div className="toolbar">
      <DateField label="از" value={from} onChange={setFrom} />
      <DateField label="تا" value={to} onChange={setTo} />
      <button className="primary" disabled={reportAction.busy} onClick={show}>
        {reportAction.busy ? 'در حال دریافت…' : 'نمایش گزارش'}
      </button>
    </div>

    <Message error={error} />
    <Message>
      «فروش تحویل‌شده» فقط سفارش‌های تحویل‌شده را می‌شمارد و سفارش‌های لغوشده در تعداد سفارش نمی‌آیند؛
      ستون جداگانه‌ای برای لغو وجود دارد.
    </Message>

    <ListState
      loading={reportAction.busy && !data}
      error={error}
      isEmpty={loaded && !reportAction.busy && data == null}
      emptyText="گزارشی برای این بازه در دسترس نیست."
    />

    {summary && <div className="metric-grid customer-report-metrics">
      {cards.map(([label, value]) => <article className="metric" key={label}>
        <span>{label}</span><strong>{value}</strong>
      </article>)}
    </div>}

    {data && <section className="panel table-wrap">
      <h2>پرخریدترین مشتریان</h2>
      {data.topCustomers.length === 0
        ? <p className="list-state">در این بازه سفارشی ثبت نشده است.</p>
        : <table>
            <thead><tr><RowNumberHead />
              <th>مشتری</th><th>موبایل</th><th>کانال</th><th>عضویت</th>
              <th>سفارش</th><th>تحویل‌شده</th><th>لغوشده</th>
              <th>مجموع خرید</th><th>میانگین سبد</th><th>آخرین سفارش</th>
            </tr></thead>
            <tbody>{paged.visible.map((row, index) => <tr key={row.customerProfileId}><RowNumberCell offset={paged.rowOffset} index={index} />
              <td>{row.preferredName}</td>
              <td><bdi dir="ltr">{row.phoneNumber || '—'}</bdi></td>
              <td>{channelLabel[row.channel]}</td>
              <td>{formatPersianDate(row.joinedAt)}</td>
              <td>{formatNumber(row.orderCount)}</td>
              <td>{formatNumber(row.deliveredCount)}</td>
              <td>{row.cancelledCount > 0 ? formatNumber(row.cancelledCount) : '—'}</td>
              <td>{formatMoney(row.totalSpent)}</td>
              <td>{formatMoney(row.averageOrderValue)}</td>
              <td>{formatPersianDateTime(row.lastOrderAt)}</td>
            </tr>)}</tbody>
          </table>}
      {data.topCustomers.length > 0 && <Pager {...paged} />}
      {data.topCustomers.length >= data.topCustomerLimit &&
        <p className="list-state">فقط {formatNumber(data.topCustomerLimit)} مشتری برتر بر اساس مجموع خرید نمایش داده می‌شود.</p>}
    </section>}
  </PageFrame>
}
