import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CustomerPaymentDto, OrderSummaryDto } from '@kafgir/contracts'
import { PaymentMethod, PaymentStatus } from '@kafgir/contracts'
import { adminApi } from './api'
import {
  AmountField, DateField, Message, PageFrame, Pager, RowNumberCell, RowNumberHead,
  useAsyncAction, useServerPagedGrid,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDateTime, parseMoney } from './number-format'
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

type Bucket = 'all' | 'successful' | 'failed' | 'pending' | 'refunded'
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
  const createAction = useAsyncAction()
  const rowAction = useAsyncAction()
  const [rowBusyId, setRowBusyId] = useState<number | null>(null)
  const [filter, setFilter] = useState<Bucket>('all')
  // The bucket filter runs in SQL. Filtering the loaded page instead would hide matching rows that
  // happen to sit on another page.
  const paged = useServerPagedGrid<CustomerPaymentDto, BucketFilters>(
    ({ page, pageSize, bucket }) => adminApi.payments({ page, pageSize }, bucket === 'all' ? undefined : bucket),
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

  const refund = (id: number) => {
    if (!window.confirm('وجه مسترد شود؟')) return
    setRowBusyId(id)
    void rowAction.run(async () => {
      try {
        await adminApi.refundPayment(id)
        setMessage('وجه مسترد شد.')
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
  ]

  return <PageFrame
    title="پرداخت‌های سفارش"
    description="پرداخت مشتری برای هر سفارش: روش، مبلغ و وضعیت. این صفحه دفتر حساب نیست."
  >
    <section className="panel admin-controls">
      <form className="form-grid two-columns" onSubmit={create}>
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
        ['pending', 'در انتظار بررسی'], ['refunded', 'مستردشده']] as Array<[Bucket, string]>)
        .map(([key, label]) => <button type="button" key={key}
          className={filter === key ? 'active' : ''} onClick={() => applyFilter(key)}>{label}</button>)}
    </div>

    <section className="panel">
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
              <td>{formatMoney(payment.amount)}</td>
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
                {payment.status === PaymentStatus.Paid && <button className="danger" disabled={rowAction.busy}
                  onClick={() => refund(payment.id)}>
                  {rowBusyId === payment.id ? 'در حال استرداد…' : 'استرداد'}
                </button>}
              </td>
            </tr>)}</tbody>
          </table></div><Pager {...paged} /></>}
    </section>
  </PageFrame>
}
