import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CustomerPaymentDto, OrderSummaryDto, PaymentReconciliationDto, UnpaidOrderDto } from '@kafgir/contracts'
import { OrderStatus, PaymentMethod, PaymentStatus } from '@kafgir/contracts'
import { adminApi } from './api'
import {
  AmountField, DateField, Message, PageFrame, Pager, RowNumberCell, RowNumberHead,
  useAsyncAction, useServerPagedGrid,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate, formatPersianDateTime, parseMoney } from './number-format'
import { todayJalali, toIsoDate } from './persian-calendar'

/**
 * Customer payments for orders.
 *
 * What is left after the accounting system was removed: which order, how much, by what means, and
 * whether it went through. A payment no longer picks a financial account or a POS terminal — the
 * method itself records that money arrived by POS, and nothing posts to a ledger.
 */

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
const today = () => toIsoDate(todayJalali())

type Bucket = 'all' | 'successful' | 'failed' | 'pending' | 'refunded' | 'refundDue'
type View = 'payments' | 'unpaid' | 'daily'
type BucketFilters = { bucket: Bucket; search?: string | null }

const statusLabel: Record<number, string> = {
  [PaymentStatus.Pending]: 'در انتظار',
  [PaymentStatus.AwaitingVerification]: 'در انتظار تأیید',
  [PaymentStatus.Paid]: 'پرداخت‌شده',
  [PaymentStatus.Failed]: 'ناموفق',
  [PaymentStatus.Rejected]: 'ردشده',
  [PaymentStatus.Cancelled]: 'لغوشده',
  [PaymentStatus.Refunded]: 'مستردشده',
}

const methodLabel: Record<number, string> = {
  [PaymentMethod.Cash]: 'نقدی',
  [PaymentMethod.CardToCard]: 'کارت‌به‌کارت',
  [PaymentMethod.Online]: 'آنلاین',
  [PaymentMethod.Pos]: 'پوز',
}

export function PaymentsPage() {
  const [view, setView] = useState<View>('payments')
  return <PageFrame
    title="پرداخت‌های سفارش"
    description="پرداخت مشتری برای هر سفارش: روش، مبلغ و وضعیت. این صفحه دفتر حساب نیست."
  >
    <div className="payment-view-tabs" role="tablist" aria-label="بخش‌های پرداخت">
      {([['payments', 'پرداخت‌ها'], ['unpaid', 'سفارش‌های پرداخت‌نشده'], ['daily', 'تراز روزانه']] as Array<[View, string]>)
        .map(([key, label]) => <button type="button" role="tab" key={key} aria-selected={view === key}
          className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>)}
    </div>
    {view === 'payments' && <PaymentsLedger />}
    {view === 'unpaid' && <UnpaidOrdersPanel />}
    {view === 'daily' && <DailyReconciliationPanel />}
  </PageFrame>
}

function PaymentsLedger() {
  const createAction = useAsyncAction()
  const rowAction = useAsyncAction()
  const [rowBusyId, setRowBusyId] = useState<number | null>(null)
  const [filter, setFilter] = useState<Bucket>('all')
  // The bucket filter runs in SQL. Filtering the loaded page instead would hide matching rows that
  // happen to sit on another page.
  const paged = useServerPagedGrid<CustomerPaymentDto, BucketFilters>(
    ({ page, pageSize, bucket, search }) => adminApi.payments({ page, pageSize }, bucket === 'all' ? undefined : bucket, search),
    { bucket: 'all' },
  )
  const [totals, setTotals] = useState<Record<Bucket, { count: number; amount: number }> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderSummaryDto[]>([])
  const [orderDate, setOrderDate] = useState(today())
  const [orderId, setOrderId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash)
  const [amount, setAmount] = useState('')

  const load = useCallback(async () => {
    try {
      const [bucketTotals, orderPage] = await Promise.all([
        adminApi.paymentTotals(),
        adminApi.orders({ date: orderDate }),
      ])
      setTotals(bucketTotals)
      setOrders(orderPage.items)
    } catch (reason) { setMessage(errorText(reason)) }
  }, [orderDate])

  useEffect(() => { void load() }, [load])

  const bucketOf = (key: Bucket) => totals?.[key] ?? { count: 0, amount: 0 }
  const applyFilter = (next: Bucket) => { setFilter(next); paged.setFilters({ bucket: next }) }

  const parsedAmount = parseMoney(amount)
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (!orderId || parsedAmount === null || parsedAmount <= 0) {
      setMessage('سفارش و مبلغ پرداخت الزامی است.')
      return
    }
    void createAction.run(async () => {
      try {
        await adminApi.createPayment({
          orderId: Number(orderId),
          paymentMethod: method,
          amount: parsedAmount,
          trackingNumber: String(data.get('trackingNumber') ?? '') || null,
          referenceNumber: null,
          receiptImageUrl: null,
          description: String(data.get('description') ?? '') || null,
        })
        setOrderId('')
        setAmount('')
        setMessage('پرداخت سفارش ثبت شد.')
        await Promise.all([load(), paged.refresh()])
      } catch (reason) { setMessage(errorText(reason)) }
    })
  }

  // `rowBusyId` marks which row shows progress; `rowAction.busy` disables every row action, because
  // approving one payment while refunding another leaves the operator unsure which result they saw.
  const change = (id: number, next: PaymentStatus) => {
    setRowBusyId(id)
    void rowAction.run(async () => {
      try {
        await adminApi.changePaymentStatus(id, next)
        setMessage('وضعیت پرداخت ثبت شد.')
        await Promise.all([load(), paged.refresh()])
      } catch (reason) { setMessage(errorText(reason)) }
      finally { setRowBusyId(null) }
    })
  }

  // A refund names its amount and reason, so it opens a small form on the row instead of a yes/no.
  const [refunding, setRefunding] = useState<{ id: number; amount: string; reason: string } | null>(null)
  const startRefund = (payment: CustomerPaymentDto) => setRefunding({
    id: payment.id,
    amount: String(Math.round((payment.amount - (payment.refundedAmount ?? 0)) * 100) / 100),
    reason: payment.orderStatus === OrderStatus.Cancelled ? 'لغو سفارش' : '',
  })
  const submitRefund = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!refunding) return
    const value = parseMoney(refunding.amount)
    if (value === null || value <= 0 || refunding.reason.trim().length < 2) {
      setMessage('مبلغ و دلیل استرداد را وارد کنید.')
      return
    }
    setRowBusyId(refunding.id)
    void rowAction.run(async () => {
      try {
        await adminApi.refundPayment(refunding.id, { amount: value, reason: refunding.reason.trim() })
        setRefunding(null)
        setMessage('استرداد ثبت شد.')
        await Promise.all([load(), paged.refresh()])
      } catch (reason) { setMessage(errorText(reason)) }
      finally { setRowBusyId(null) }
    })
  }

  const buckets: Array<[Bucket, string, string]> = [
    ['successful', 'پرداخت موفق', 'success'],
    ['failed', 'پرداخت ناموفق', 'failed'],
    ['pending', 'نیازمند بررسی', 'pending'],
    ['refunded', 'برگشت وجه', 'refunded'],
    ['refundDue', 'استرداد معوق', 'failed'],
  ]

  return <>
    <section className="panel admin-controls">
      <form className="form-grid two-columns compact-entry-form" onSubmit={create}>
        <DateField label="تاریخ سفارش" value={orderDate} onChange={setOrderDate} />
        <label className="field">سفارش
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)} required>
            <option value="">انتخاب</option>
            {orders.map((order) => <option key={order.id} value={order.id}>
              {order.orderNumber} — {order.customerFullName} — {formatMoney(order.totalAmount)}
            </option>)}
          </select>
        </label>
        <label className="field">روش
          <select value={method} onChange={(event) => setMethod(Number(event.target.value) as PaymentMethod)}>
            {Object.entries(methodLabel).map(([value, label]) =>
              <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <AmountField label="مبلغ (تومان)" value={amount} onChange={setAmount} />
        <label className="field">شماره پیگیری<input name="trackingNumber" dir="ltr" /></label>
        <label className="field">شرح<input name="description" /></label>
        <div className="form-actions">
          <button className="primary" disabled={createAction.busy}>
            {createAction.busy ? 'در حال ثبت…' : 'ثبت پرداخت'}
          </button>
        </div>
      </form>
    </section>

    <Message>{message}</Message>
    {bucketOf('refundDue').count > 0 && <Message error={`${formatNumber(bucketOf('refundDue').count)} پرداخت موفق متعلق به سفارش لغوشده است و ${formatMoney(bucketOf('refundDue').amount)} باید به مشتری برگردد.`} />}

    <section className="payment-status-overview" aria-label="خلاصه پرداخت مشتریان">
      {buckets.map(([key, label, tone]) => {
        const value = bucketOf(key)
        return <button type="button" key={key}
          className={`payment-metric ${tone}${filter === key ? ' active' : ''}`}
          onClick={() => applyFilter(key)}>
          <span>{label}</span>
          <strong>{formatNumber(value.count)}</strong>
          <small>{formatMoney(value.amount)}</small>
        </button>
      })}
    </section>

    <div className="payment-filter-bar" role="group" aria-label="فیلتر وضعیت پرداخت">
      {([['all', 'همه'], ['successful', 'موفق'], ['failed', 'ناموفق'],
        ['pending', 'در انتظار بررسی'], ['refunded', 'مستردشده'], ['refundDue', 'استرداد معوق']] as Array<[Bucket, string]>)
        .map(([key, label]) => <button type="button" key={key}
          className={filter === key ? 'active' : ''} onClick={() => applyFilter(key)}>{label}</button>)}
      <label className="payment-order-search">
        <span>شماره سفارش</span>
        <input dir="ltr" placeholder="1405-482917" value={paged.filters.search ?? ''}
          onChange={(event) => paged.setFilters({ search: event.target.value })} />
      </label>
    </div>

    <section className="panel compact-grid-panel">
      <div className="table-panel-head">
        <h2>پرداخت‌های مشتریان</h2>
        <span>{formatNumber(paged.totalItems)} مورد</span>
      </div>
      {paged.visible.length === 0
        ? <p className="list-state">در این وضعیت پرداختی وجود ندارد.</p>
        : <><div className="table-wrap"><table>
            <thead><tr><RowNumberHead />
              <th>سفارش</th><th>مشتری</th><th>موبایل</th><th>روش</th><th>مبلغ</th>
              <th>پیگیری</th><th>زمان ثبت</th><th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody>{paged.visible.map((payment, index) => <tr key={payment.id}>
              <RowNumberCell offset={paged.rowOffset} index={index} />
              <td dir="ltr">{payment.orderNumber}</td>
              <td>{payment.customerFullName}</td>
              <td dir="ltr">{payment.customerPhoneNumber}</td>
              <td>{methodLabel[payment.paymentMethod]}</td>
              <td>{formatMoney(payment.amount)}{(payment.refundedAmount ?? 0) > 0 && <small className="refund-note">
                مسترد: {formatMoney(payment.refundedAmount ?? 0)}{payment.refundReason ? ` — ${payment.refundReason}` : ''}
              </small>}{payment.orderStatus === OrderStatus.Cancelled && <small className="refund-note warn">سفارش لغو شده</small>}</td>
              <td dir="ltr">{payment.trackingNumber || payment.referenceNumber || '—'}</td>
              <td>{formatPersianDateTime(payment.createdAt)}</td>
              <td><span className={`payment-status payment-status-${payment.status}`}>
                {statusLabel[payment.status]}
              </span></td>
              <td className="actions">
                {[PaymentStatus.Pending, PaymentStatus.AwaitingVerification].includes(payment.status) && <>
                  <button className="primary" disabled={rowAction.busy}
                    onClick={() => change(payment.id, PaymentStatus.Paid)}>
                    {rowBusyId === payment.id ? '…' : 'تأیید'}
                  </button>
                  <button className="danger" disabled={rowAction.busy}
                    onClick={() => change(payment.id, PaymentStatus.Rejected)}>
                    {rowBusyId === payment.id ? '…' : 'رد'}
                  </button>
                </>}
                {payment.status === PaymentStatus.Paid && refunding?.id !== payment.id && <button className="danger" disabled={rowAction.busy}
                  onClick={() => startRefund(payment)}>استرداد</button>}
                {refunding?.id === payment.id && <form className="refund-form" onSubmit={submitRefund}>
                  <input aria-label="مبلغ استرداد" dir="ltr" value={refunding.amount}
                    onChange={(event) => setRefunding({ ...refunding, amount: event.target.value })} />
                  <input aria-label="دلیل استرداد" placeholder="دلیل" value={refunding.reason}
                    onChange={(event) => setRefunding({ ...refunding, reason: event.target.value })} />
                  <button className="danger" disabled={rowAction.busy}>{rowBusyId === payment.id ? '…' : 'ثبت'}</button>
                  <button type="button" onClick={() => setRefunding(null)}>انصراف</button>
                </form>}
              </td>
            </tr>)}</tbody>
          </table></div><Pager {...paged} /></>}
    </section>
  </>
}

/** Orders handed over (or ready) whose money has not fully arrived — the end-of-day collection list. */
function UnpaidOrdersPanel() {
  const paged = useServerPagedGrid<UnpaidOrderDto, Record<string, never>>(
    ({ page, pageSize }) => adminApi.unpaidOrders({ page, pageSize }), {},
  )
  return <section className="panel compact-grid-panel">
    <div className="table-panel-head">
      <h2>سفارش‌های تحویلی بدون پرداخت کامل</h2>
      <span>{formatNumber(paged.totalItems)} سفارش</span>
    </div>
    {paged.visible.length === 0
      ? <p className="list-state">{paged.loading ? 'در حال دریافت…' : 'همه سفارش‌های تحویلی تسویه شده‌اند.'}</p>
      : <><div className="table-wrap"><table>
          <thead><tr><RowNumberHead /><th>سفارش</th><th>روز سرویس</th><th>مشتری</th><th>موبایل</th>
            <th>روش</th><th>وضعیت</th><th>مبلغ سفارش</th><th>دریافت‌شده</th><th>در انتظار تأیید</th><th>مانده</th></tr></thead>
          <tbody>{paged.visible.map((order, index) => <tr key={order.orderId}>
            <RowNumberCell offset={paged.rowOffset} index={index} />
            <td dir="ltr">{order.orderNumber}</td>
            <td>{formatPersianDate(order.serviceDate)}</td>
            <td>{order.customerFullName}</td>
            <td dir="ltr">{order.customerPhoneNumber}</td>
            <td>{methodLabel[order.paymentMethod]}</td>
            <td>{order.status === OrderStatus.Delivered ? 'تحویل‌شده' : 'آماده تحویل'}</td>
            <td>{formatMoney(order.totalAmount)}</td>
            <td>{formatMoney(order.paidAmount)}</td>
            <td>{order.pendingAmount > 0 ? formatMoney(order.pendingAmount) : '—'}</td>
            <td><strong className="amount-due">{formatMoney(order.balance)}</strong></td>
          </tr>)}</tbody>
        </table></div><Pager {...paged} /></>}
  </section>
}

/** A day's money by method, for closing the till. */
function DailyReconciliationPanel() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<PaymentReconciliationDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setError(null)
    void adminApi.paymentReconciliation(date).then(setData).catch((reason) => setError(errorText(reason)))
  }, [date])
  return <>
    <section className="panel admin-controls">
      <div className="form-grid compact-entry-form"><DateField label="روز" value={date} onChange={setDate} /></div>
    </section>
    <Message error={error} />
    {data && <>
      <section className="payment-status-overview" aria-label="جمع روز">
        <div className="payment-metric success"><span>دریافت</span><strong>{formatMoney(data.totals.received)}</strong></div>
        <div className="payment-metric refunded"><span>استرداد</span><strong>{formatMoney(data.totals.refunded)}</strong></div>
        <div className="payment-metric pending"><span>خالص روز</span><strong>{formatMoney(data.totals.net)}</strong></div>
        <div className="payment-metric failed"><span>تحویلی بدون پرداخت کامل</span><strong>{formatNumber(data.unpaidDeliveredCount)}</strong>
          <small>{formatMoney(data.unpaidDeliveredAmount)}</small></div>
      </section>
      <section className="panel table-wrap">
        <table><thead><tr><th>روش</th><th>تعداد</th><th>دریافت</th><th>استرداد</th><th>خالص</th></tr></thead>
          <tbody>{data.methods.length === 0
            ? <tr><td colSpan={5}>در این روز پرداختی تأیید نشده است.</td></tr>
            : data.methods.map((row) => <tr key={row.paymentMethod}>
                <td>{methodLabel[row.paymentMethod]}</td><td>{formatNumber(row.count)}</td>
                <td>{formatMoney(row.received)}</td><td>{formatMoney(row.refunded)}</td>
                <td><strong>{formatMoney(row.net)}</strong></td>
              </tr>)}</tbody></table>
      </section>
    </>}
  </>
}
