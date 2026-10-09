import { useEffect, useState } from 'react'
import type { LeftoverItemDto, ProductionSheetDto } from '@kafgir/contracts'
import { DeliveryMethod, OrderStatus, PaymentMethod } from '@kafgir/contracts'
import { adminApi } from './api'
import { DateField, Message, PageFrame } from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate } from './number-format'
import { todayJalali, toIsoDate } from './persian-calendar'

/**
 * The kitchen's day on one screen and on paper: portions to cook per dish (Persian rice folded in),
 * how the orders spread over the delivery windows, and one packing card per order that doubles as a
 * bag label. Everything comes from orders whose service day is the chosen date.
 */

type View = 'cook' | 'slots' | 'pack' | 'leftover'

const statusLabel: Record<number, string> = {
  [OrderStatus.PendingConfirmation]: 'در انتظار تأیید',
  [OrderStatus.Confirmed]: 'تأییدشده',
  [OrderStatus.Preparing]: 'در حال آماده‌سازی',
  [OrderStatus.Ready]: 'آماده',
  [OrderStatus.Delivered]: 'تحویل‌شده',
}

const paymentLabel: Record<number, string> = {
  [PaymentMethod.Cash]: 'نقدی', [PaymentMethod.CardToCard]: 'کارت‌به‌کارت',
  [PaymentMethod.Online]: 'آنلاین', [PaymentMethod.Pos]: 'کارت‌خوان',
}

export function KitchenPage() {
  const [date, setDate] = useState(toIsoDate(todayJalali()))
  const [view, setView] = useState<View>('cook')
  const [sheet, setSheet] = useState<ProductionSheetDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includePending, setIncludePending] = useState(false)

  useEffect(() => {
    setError(null)
    setSheet(null)
    void adminApi.productionSheet(date).then(setSheet).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [date])

  const print = () => {
    document.body.dataset.kitchenPrint = view
    const clear = () => { delete document.body.dataset.kitchenPrint; window.removeEventListener('afterprint', clear) }
    window.addEventListener('afterprint', clear)
    window.print()
  }

  const packing = sheet?.orders.filter((order) => order.status !== OrderStatus.Delivered
    && (includePending || order.status !== OrderStatus.PendingConfirmation)) ?? []
  const totalToCook = sheet?.dishes.reduce((sum, dish) => sum + dish.toCook, 0) ?? 0
  const totalPending = sheet?.dishes.reduce((sum, dish) => sum + dish.pending, 0) ?? 0

  return <PageFrame title="برگه آشپزخانه و بسته‌بندی"
    description="چه چیزی، چند پرس، برای کدام بازه؛ و یک برچسب برای هر کیسه."
    actions={view !== 'leftover' && <button type="button" className="primary" onClick={print} disabled={!sheet}>چاپ این بخش</button>}>
    <section className="toolbar kitchen-toolbar">
      <DateField label="روز سرویس" value={date} onChange={setDate} />
      <div className="payment-view-tabs" role="tablist">
        {([['cook', 'پخت'], ['slots', 'بازه‌های ارسال'], ['pack', 'بسته‌بندی و برچسب'], ['leftover', 'باقی‌مانده روز']] as Array<[View, string]>).map(([key, label]) =>
          <button type="button" role="tab" key={key} aria-selected={view === key} className={view === key ? 'active' : ''}
            onClick={() => setView(key)}>{label}</button>)}
      </div>
      {view === 'pack' && <label className="switch"><input type="checkbox" checked={includePending}
        onChange={(event) => setIncludePending(event.target.checked)} />سفارش‌های در انتظار تأیید هم</label>}
    </section>
    <Message error={error} />
    {view === 'leftover' && <LeftoverPanel date={date} />}
    {sheet && view !== 'leftover' && <div className={`kitchen-print kitchen-print-${view}`}>
      <h2 className="kitchen-print-title">{formatPersianDate(sheet.date)} — {view === 'cook' ? 'برگه پخت' : view === 'slots' ? 'بازه‌های ارسال' : 'بسته‌بندی'}</h2>

      {view === 'cook' && <section className="panel kitchen-cook">
        {sheet.dishes.length === 0
          ? <p className="list-state">برای این روز سفارشی ثبت نشده است.</p>
          : <table>
              <thead><tr><th>غذا</th><th>برای پخت</th><th>با برنج ایرانی</th><th>در انتظار تأیید</th><th>تحویل‌شده</th></tr></thead>
              <tbody>{sheet.dishes.map((dish) => <tr key={dish.foodName}>
                <td className="kitchen-dish">{dish.foodName}</td>
                <td><strong className="kitchen-count">{formatNumber(dish.toCook)}</strong></td>
                <td>{dish.withPersianRice > 0 ? formatNumber(dish.withPersianRice) : '—'}</td>
                <td>{dish.pending > 0 ? <span className="badge status-1">+{formatNumber(dish.pending)}</span> : '—'}</td>
                <td>{dish.delivered > 0 ? formatNumber(dish.delivered) : '—'}</td>
              </tr>)}</tbody>
              <tfoot><tr><td>جمع</td><td><strong className="kitchen-count">{formatNumber(totalToCook)}</strong></td>
                <td>{formatNumber(sheet.persianRicePortions)}</td><td>{totalPending > 0 ? `+${formatNumber(totalPending)}` : '—'}</td><td /></tr></tfoot>
            </table>}
        {sheet.persianRicePortions > 0 && <p className="kitchen-note">برنج ایرانی: {formatNumber(sheet.persianRicePortions)} پرس (برای سفارش‌های تأییدشده)</p>}
      </section>}

      {view === 'slots' && <section className="kitchen-slots">
        {sheet.slots.length === 0 && <p className="list-state panel">برای این روز سفارشی ثبت نشده است.</p>}
        {sheet.slots.map((slot) => <article className="panel kitchen-slot" key={slot.key}>
          <h3>{slot.title}</h3>
          <p><strong>{formatNumber(slot.orders)}</strong> سفارش · <strong>{formatNumber(slot.portions)}</strong> پرس</p>
          <ul>{sheet.orders.filter((order) => order.slotKey === slot.key && order.status !== OrderStatus.Delivered).map((order) =>
            <li key={order.id}><bdi dir="ltr">{order.orderNumber}</bdi> — {order.customerFullName}
              {order.status === OrderStatus.PendingConfirmation && <span className="badge status-1">تأیید نشده</span>}</li>)}</ul>
        </article>)}
      </section>}

      {view === 'pack' && <section className="kitchen-labels">
        {packing.length === 0 && <p className="list-state panel">سفارشی برای بسته‌بندی نیست.</p>}
        {packing.map((order) => <article className="kitchen-label" key={order.id}>
          <header>
            <strong dir="ltr">{order.orderNumber}</strong>
            <span className={order.isExpress ? 'kitchen-slot-tag express' : 'kitchen-slot-tag'}>{order.slotTitle}</span>
          </header>
          <div className="kitchen-label-customer">
            <b>{order.customerFullName}</b> · <bdi dir="ltr">{order.customerPhoneNumber}</bdi>
            {order.deliveryMethod === DeliveryMethod.Delivery && order.address && <p>{order.address}</p>}
          </div>
          <ul>{order.lines.map((line, index) => <li key={`${line.foodName}-${index}`}>
            <span className="kitchen-qty">{formatNumber(line.quantity)}×</span> {line.foodName}
            {line.withPersianRice && <em> + برنج ایرانی</em>}
          </li>)}</ul>
          {order.customerNote && <p className="kitchen-label-note">یادداشت: {order.customerNote}</p>}
          <footer><span>{paymentLabel[order.paymentMethod]}</span><span>{formatMoney(order.totalAmount)}</span>
            {order.status !== OrderStatus.Confirmed && <span>{statusLabel[order.status]}</span>}</footer>
        </article>)}
      </section>}
    </div>}
  </PageFrame>
}

/** Closing count: what of each dish was cooked but not sold. Feeds the month's leftover rate. */
function LeftoverPanel({ date }: { date: string }) {
  const [items, setItems] = useState<LeftoverItemDto[] | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const show = (rows: LeftoverItemDto[]) => {
    setItems(rows)
    setDrafts(Object.fromEntries(rows.map((row) => [row.dailyMenuItemId, row.leftoverPortions == null ? '' : String(row.leftoverPortions)])))
  }
  useEffect(() => {
    setItems(null)
    setNotice(null)
    void adminApi.leftovers(date).then(show).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [date])

  const parsed = (text: string) => {
    const digits = text.trim().replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    if (!digits) return null
    const value = Number(digits)
    return Number.isInteger(value) && value >= 0 ? value : Number.NaN
  }

  const save = async () => {
    if (!items) return
    const values = items.map((item) => ({ dailyMenuItemId: item.dailyMenuItemId, leftoverPortions: parsed(drafts[item.dailyMenuItemId] ?? '') }))
    if (values.some((value) => Number.isNaN(value.leftoverPortions))) { setError('تعداد باقی‌مانده باید عدد صحیح و نامنفی باشد.'); return }
    setBusy(true)
    setError(null)
    try {
      show(await adminApi.saveLeftovers({ date, items: values }))
      setNotice('باقی‌مانده روز ثبت شد.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }

  const total = items?.reduce((sum, item) => sum + (parsed(drafts[item.dailyMenuItemId] ?? '') || 0), 0) ?? 0
  return <section className="panel kitchen-leftovers">
    <Message error={error} />
    {notice && <Message>{notice}</Message>}
    {!items ? <p className="list-state">در حال دریافت…</p>
      : items.length === 0 ? <p className="list-state">برای این روز منویی ثبت نشده است.</p>
      : <>
        <p className="muted">پایان روز، پرس‌هایی که پخته شد ولی فروش نرفت را بشمارید. خالی یعنی هنوز شمرده نشده.</p>
        <table>
          <thead><tr><th>غذا</th><th>ظرفیت</th><th>فروخته</th><th>باقی‌مانده (پرس)</th><th>ثبت</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.dailyMenuItemId}>
            <td className="kitchen-dish">{item.foodName}</td>
            <td>{formatNumber(item.capacityPortions)}</td>
            <td>{formatNumber(item.soldPortions)}</td>
            <td><input className="leftover-input" inputMode="numeric" aria-label={`باقی‌مانده ${item.foodName}`}
              value={drafts[item.dailyMenuItemId] ?? ''} placeholder="—"
              onChange={(event) => setDrafts({ ...drafts, [item.dailyMenuItemId]: event.target.value })} /></td>
            <td className="muted">{item.recordedAt ? new Date(item.recordedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }) : '—'}</td>
          </tr>)}</tbody>
          <tfoot><tr><td>جمع</td><td /><td /><td><strong>{formatNumber(total)}</strong></td><td /></tr></tfoot>
        </table>
        <div className="action-row"><button type="button" className="primary" disabled={busy} onClick={() => void save()}>{busy ? 'در حال ثبت…' : 'ثبت باقی‌مانده'}</button></div>
      </>}
  </section>
}
