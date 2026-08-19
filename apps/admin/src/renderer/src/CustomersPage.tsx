import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { OrderStatus, type CustomerDetailDto, type CustomerDirectoryPageDto, type CustomerDirectoryQuery } from '@kafgir/contracts'
import { adminApi } from './api'
import {
  DateField, ListState, Message, PageFrame, Pager, RowNumberCell, RowNumberHead,
  defaultPageSize, rowOffsetOf, useAsyncAction, usePagination,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate, formatPersianDateTime } from './number-format'

/**
 * Look up a customer and read their history.
 *
 * Master–detail rather than a drill-down page: an operator on the phone with a customer needs the
 * result list to stay put while they open one record, the same way the orders screen works.
 *
 * Money follows the customer report exactly — spend is delivered orders, order counts exclude
 * cancellations — so the same person never shows two lifetime values across screens.
 */

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'در انتظار تایید',
  [OrderStatus.Confirmed]: 'تایید شده',
  [OrderStatus.Preparing]: 'در حال آماده‌سازی',
  [OrderStatus.Ready]: 'آماده تحویل',
  [OrderStatus.Delivered]: 'تحویل شده',
  [OrderStatus.Cancelled]: 'لغو شده',
}

const activityLabel: Record<CustomerDirectoryQuery['activity'], string> = {
  all: 'همه مشتریان',
  'has-ordered': 'دارای سفارش',
  'never-ordered': 'بدون سفارش',
  lapsed: 'مدتی سفارش نداده',
  'active-order': 'سفارش در جریان',
}

const sortLabel: Record<CustomerDirectoryQuery['sort'], string> = {
  lastOrder: 'آخرین سفارش',
  totalSpent: 'مجموع خرید',
  orderCount: 'تعداد سفارش',
  joined: 'تاریخ عضویت',
  name: 'نام',
}

const emptyQuery: CustomerDirectoryQuery = {
  search: null, firstName: null, lastName: null, channel: null, joinedFrom: null, joinedTo: null,
  activity: 'all', lapsedDays: 60, minOrders: null, minSpent: null, city: null,
  sort: 'lastOrder', page: 1, pageSize: defaultPageSize,
}

const numberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function CustomersPage() {
  const [query, setQuery] = useState<CustomerDirectoryQuery>(emptyQuery)
  const [page, setPage] = useState<CustomerDirectoryPageDto | null>(null)
  const [selected, setSelected] = useState<CustomerDetailDto | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchAction = useAsyncAction()
  const detailAction = useAsyncAction()
  const pagedOrders = usePagination(selected?.orders ?? [])

  const load = useCallback(async (next: CustomerDirectoryQuery) => {
    try {
      setPage(await adminApi.searchCustomers(next))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setLoaded(true) }
  }, [])

  useEffect(() => { void searchAction.run(() => load(emptyQuery)) }, [])

  const runSearch = (next: CustomerDirectoryQuery) => {
    setQuery(next)
    void searchAction.run(() => load(next))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    runSearch({ ...query, page: 1 })
  }

  const reset = () => {
    setSelected(null)
    runSearch(emptyQuery)
  }

  const open = (id: number) => {
    setOpeningId(id)
    void detailAction.run(async () => {
      try {
        setSelected(await adminApi.customerDetail(id))
        setError(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally { setOpeningId(null) }
    })
  }

  const goToPage = (next: number) => runSearch({ ...query, page: next })
  const patch = (value: Partial<CustomerDirectoryQuery>) => setQuery((current) => ({ ...current, ...value }))
  const totals = selected?.totals

  return <PageFrame
    title="مشتریان"
    description="جست‌وجوی مشتری و مشاهده کامل سابقه سفارش، آدرس و نظرهای او."
    actions={<button type="button" onClick={() => setShowAdvanced((value) => !value)}>
      {showAdvanced ? 'بستن جست‌وجوی پیشرفته' : 'جست‌وجوی پیشرفته'}
    </button>}
  >
    <form className="panel admin-controls customer-search" onSubmit={submit}>
      <div className="toolbar customer-search-basic">
        <label className="customer-search-term">نام یا شماره موبایل
          <input value={query.search ?? ''} placeholder="فائزه یا ۰۹۱۲…"
            onChange={(event) => patch({ search: event.target.value || null })} />
        </label>
        <label>وضعیت
          <select value={query.activity}
            onChange={(event) => patch({ activity: event.target.value as CustomerDirectoryQuery['activity'] })}>
            {Object.entries(activityLabel).map(([value, label]) =>
              <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>مرتب‌سازی
          <select value={query.sort}
            onChange={(event) => patch({ sort: event.target.value as CustomerDirectoryQuery['sort'] })}>
            {Object.entries(sortLabel).map(([value, label]) =>
              <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="primary" disabled={searchAction.busy}>
          {searchAction.busy ? 'در حال جست‌وجو…' : 'جست‌وجو'}
        </button>
        <button type="button" onClick={reset} disabled={searchAction.busy}>پاک کردن</button>
      </div>

      {showAdvanced && <div className="toolbar customer-search-advanced">
        <label>نام<input value={query.firstName ?? ''} placeholder="فائزه"
          onChange={(event) => patch({ firstName: event.target.value || null })} /></label>
        <label>نام خانوادگی<input value={query.lastName ?? ''} placeholder="علی پور"
          onChange={(event) => patch({ lastName: event.target.value || null })} /></label>
        <label>کانال
          <select value={query.channel ?? ''}
            onChange={(event) => patch({ channel: (event.target.value || null) as CustomerDirectoryQuery['channel'] })}>
            <option value="">همه</option>
            <option value="phone">موبایل</option>
            <option value="telegram">تلگرام</option>
          </select>
        </label>
        <DateField label="عضویت از" allowClear value={query.joinedFrom ?? ''}
          onChange={(value) => patch({ joinedFrom: value || null })} />
        <DateField label="عضویت تا" allowClear value={query.joinedTo ?? ''}
          onChange={(value) => patch({ joinedTo: value || null })} />
        <label>حداقل تعداد سفارش<input type="number" min="0" value={query.minOrders ?? ''}
          onChange={(event) => patch({ minOrders: numberOrNull(event.target.value) })} /></label>
        <label>حداقل مجموع خرید<input inputMode="numeric" dir="ltr" value={query.minSpent ?? ''}
          onChange={(event) => patch({ minSpent: numberOrNull(event.target.value) })} /></label>
        <label>شهر<input value={query.city ?? ''}
          onChange={(event) => patch({ city: event.target.value || null })} /></label>
        {query.activity === 'lapsed' && <label>بدون سفارش از (روز)
          <input type="number" min="1" value={query.lapsedDays}
            onChange={(event) => patch({ lapsedDays: Number(event.target.value) || 60 })} />
        </label>}

      </div>}
    </form>

    <Message error={error} />

    <div className="customers-workspace">
      <section className="customers-results">
        <ListState
          loading={searchAction.busy && !page}
          error={error}
          isEmpty={loaded && !searchAction.busy && (page?.items.length ?? 0) === 0}
          emptyText="مشتری با این مشخصات پیدا نشد."
        />
        {page && page.items.length > 0 && <>
          <div className="table-summary">
            <span>{formatNumber(page.totalItems)} مشتری</span>
            {searchAction.busy && <span>در حال جست‌وجو…</span>}
          </div>
          <div className="panel table-wrap"><table>
            <thead><tr>
              <RowNumberHead /><th>نام</th><th>موبایل</th><th>کانال</th><th>شهر</th>
              <th>سفارش</th><th>مجموع خرید</th><th>آخرین سفارش</th><th />
            </tr></thead>
            <tbody>{page.items.map((row, index) => <tr key={row.customerProfileId}
              className={selected?.customerProfileId === row.customerProfileId ? 'selected-row' : ''}>
              <RowNumberCell offset={rowOffsetOf(page.page, page.pageSize)} index={index} />
              <td>{row.preferredName}{row.hasActiveOrder && <span className="badge open">سفارش فعال</span>}</td>
              <td><bdi dir="ltr">{row.phoneNumber || '—'}</bdi></td>
              <td>{row.channel === 'telegram' ? 'تلگرام' : 'موبایل'}</td>
              <td>{row.city ?? '—'}</td>
              <td>{formatNumber(row.orderCount)}{row.cancelledCount > 0 && <small> ({formatNumber(row.cancelledCount)} لغو)</small>}</td>
              <td>{formatMoney(row.totalSpent)}</td>
              <td>{formatPersianDateTime(row.lastOrderAt)}</td>
              <td><button type="button" disabled={detailAction.busy}
                onClick={() => open(row.customerProfileId)}>
                {openingId === row.customerProfileId ? 'در حال باز کردن…' : 'سابقه'}
              </button></td>
            </tr>)}</tbody>
          </table></div>
          <Pager
            page={page.page}
            pageSize={page.pageSize}
            totalItems={page.totalItems}
            totalPages={page.totalPages}
            rowOffset={rowOffsetOf(page.page, page.pageSize)}
            setPage={goToPage}
            setPageSize={(size) => runSearch({ ...query, pageSize: size, page: 1 })}
            busy={searchAction.busy}
          />
        </>}
      </section>

      <aside className="panel customer-detail-pane">
        {!selected || !totals
          ? <p className="list-state">برای دیدن سابقه، یک مشتری را انتخاب کنید.</p>
          : <>
            <header className="customer-detail-head">
              <div>
                <h2>{selected.preferredName}</h2>
                <p><bdi dir="ltr">{selected.phoneNumber || '—'}</bdi>
                  {selected.telegramUsername && <> · <bdi dir="ltr">@{selected.telegramUsername}</bdi></>}
                </p>
                <small>عضویت {formatPersianDate(selected.joinedAt)} · {selected.channel === 'telegram' ? 'تلگرام' : 'موبایل'}</small>
              </div>
              <button type="button" onClick={() => setSelected(null)}>بستن</button>
            </header>

            <div className="metric-grid customer-detail-metrics">
              <article className="metric"><span>سفارش</span><strong>{formatNumber(totals.orderCount)}</strong></article>
              <article className="metric"><span>تحویل‌شده</span><strong>{formatNumber(totals.deliveredCount)}</strong></article>
              <article className="metric"><span>لغوشده</span><strong>{formatNumber(totals.cancelledCount)}</strong></article>
              <article className="metric"><span>مجموع خرید</span><strong>{formatMoney(totals.totalSpent)}</strong></article>
              <article className="metric"><span>میانگین سبد</span><strong>{formatMoney(totals.averageOrderValue)}</strong></article>
              <article className="metric"><span>امتیاز میانگین</span>
                <strong>{totals.averageRating == null ? '—' : formatNumber(totals.averageRating)}</strong></article>
            </div>
            <p className="customer-detail-span">
              نخستین سفارش {formatPersianDate(totals.firstOrderAt)} · آخرین سفارش {formatPersianDateTime(totals.lastOrderAt)}
              {totals.supportConversationCount > 0 &&
                <> · {formatNumber(totals.supportConversationCount)} گفتگوی پشتیبانی</>}
            </p>

            <section className="customer-detail-section">
              <h3>آدرس‌ها</h3>
              {selected.addresses.length === 0
                ? <p className="list-state">آدرسی ثبت نشده است.</p>
                : <ul className="customer-address-list">{selected.addresses.map((address) => <li key={address.id}>
                    <strong>{address.title}</strong>
                    {address.isDefault && <span className="badge open">پیش‌فرض</span>}
                    {!address.isActive && <span className="badge closed">حذف‌شده</span>}
                    <span>{address.city}، {address.addressLine}</span>
                  </li>)}</ul>}
            </section>

            <section className="customer-detail-section">
              <h3>سابقه سفارش</h3>
              {selected.orders.length === 0
                ? <p className="list-state">هنوز سفارشی ثبت نکرده است.</p>
                : <div className="table-wrap"><table>
                    <thead><tr><RowNumberHead /><th>شماره</th><th>تاریخ</th><th>وضعیت</th><th>مبلغ</th><th>اقلام</th><th>تحویل</th></tr></thead>
                    <tbody>{pagedOrders.visible.map((order, index) => <tr key={order.id}><RowNumberCell offset={pagedOrders.rowOffset} index={index} />
                      <td><bdi dir="ltr">{order.orderNumber}</bdi></td>
                      <td>{formatPersianDateTime(order.createdAt)}</td>
                      <td><span className={`badge status-${order.status}`}>{statusLabel[order.status]}</span></td>
                      <td>{formatMoney(order.totalAmount)}</td>
                      <td className="customer-order-items">{order.itemSummary || '—'}</td>
                      <td>{order.deliveryWindow ?? (order.deliveryDate ? formatPersianDate(order.deliveryDate) : '—')}</td>
                    </tr>)}</tbody>
                  </table></div>}
              {selected.orders.length > 0 && <Pager {...pagedOrders} />}
              {selected.orders.length >= selected.orderLimit &&
                <p className="list-state">فقط {formatNumber(selected.orderLimit)} سفارش اخیر نمایش داده می‌شود.</p>}
            </section>

            {selected.reviews.length > 0 && <section className="customer-detail-section">
              <h3>نظرها</h3>
              <ul className="customer-review-list">{selected.reviews.map((review) => <li key={review.orderId}>
                <span><bdi dir="ltr">{review.orderNumber}</bdi> · {formatNumber(review.rating)} از ۵ · {formatPersianDate(review.createdAt)}</span>
                {review.comment && <p>{review.comment}</p>}
              </li>)}</ul>
            </section>}
          </>}
      </aside>
    </div>
  </PageFrame>
}
