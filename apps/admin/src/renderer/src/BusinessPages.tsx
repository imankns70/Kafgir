import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  MonthListItemDto,
  MonthPurchasesDto,
  MonthlyDailyPointDto,
  MonthlyReportDto,
  PurchaseDto,
} from '@kafgir/contracts'
import { persianMonthNames } from '@kafgir/contracts'
import { adminApi } from './api'
import {
  AmountField, DateField, ListState, Message, PageFrame, Pager, RowNumberCell, RowNumberHead,
  useAsyncAction, usePagination,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate, moneyInputText, parseMoney } from './number-format'
import { todayJalali, toIsoDate } from './persian-calendar'

/**
 * Purchases and the monthly picture.
 *
 * Both pages answer one question — «این ماه چقدر خرید کردیم و چقدر فروختیم؟» — and are written for
 * someone who has never seen an accounting screen. There is no period to open or close, no approval
 * step and no ledger: a month exists because it happened, and a purchase is a line you write down.
 */

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

const percentText = (value: number | null) =>
  value === null ? '—' : `${formatNumber(value, 1)}٪`

/** «۵۷٪ از فروش» in a sentence a kitchen operator can read without translating it. */
const ratioSentence = (percent: number | null) => percent === null
  ? 'این ماه هنوز فروشی ثبت نشده است.'
  : `از هر ۱۰۰٬۰۰۰ تومان فروش غذا، حدود ${formatNumber(Math.round(percent * 1000))} تومان خرید ثبت شده است.`

type MonthState = { year: number; month: number }

const currentMonth = (): MonthState => {
  const today = todayJalali()
  return { year: today.jy, month: today.jm }
}

/** A month picker built from the calendar rather than from stored periods. */
function MonthSelect({ value, onChange, months }: {
  value: MonthState
  onChange: (value: MonthState) => void
  months: MonthListItemDto[]
}) {
  const key = `${value.year}-${value.month}`
  return <label className="field">ماه
    <select value={key} onChange={(event) => {
      const [year, month] = event.target.value.split('-').map(Number)
      if (year && month) onChange({ year, month })
    }}>
      {months.map((item) => <option key={`${item.year}-${item.month}`} value={`${item.year}-${item.month}`}>
        {item.title}
      </option>)}
    </select>
  </label>
}

type PurchaseForm = {
  id: number | null
  purchaseDate: string
  amount: string
  title: string
  sellerName: string
  notes: string
}

const emptyForm = (): PurchaseForm => ({
  id: null,
  purchaseDate: toIsoDate(todayJalali()),
  amount: '',
  title: '',
  sellerName: '',
  notes: '',
})

/**
 * Writing a purchase down.
 *
 * Date, amount, a few words — the seller and a note are optional and nothing else is asked. Anything
 * more would be a form somebody skips, and a skipped form means a month that under-reports what was
 * actually spent.
 */
export function PurchasesPage() {
  const [month, setMonth] = useState<MonthState>(currentMonth)
  const [data, setData] = useState<MonthPurchasesDto | null>(null)
  const [months, setMonths] = useState<MonthListItemDto[]>([])
  const [form, setForm] = useState<PurchaseForm>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const removeAction = useAsyncAction()
  const paged = usePagination(data?.purchases ?? [])

  const load = useCallback(async (value: MonthState) => {
    setLoading(true)
    try {
      setData(await adminApi.monthPurchases(value.year, value.month))
      setError(null)
    } catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(month) }, [month, load])
  useEffect(() => {
    void adminApi.months().then(setMonths).catch((reason) => setError(errorText(reason)))
  }, [])

  const amount = parseMoney(form.amount)
  const canSave = amount !== null && amount > 0 && form.title.trim() !== ''

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!canSave) {
      setError('تاریخ، مبلغ و عنوان خرید الزامی است.')
      return
    }
    setBusy(true)
    const value = {
      purchaseDate: form.purchaseDate,
      amount: amount!,
      title: form.title.trim(),
      sellerName: form.sellerName.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (form.id == null) await adminApi.createPurchase(value)
      else await adminApi.updatePurchase(form.id, value)
      setNotice(form.id == null ? 'خرید ثبت شد.' : 'خرید ویرایش شد.')
      setForm(emptyForm())
      await load(month)
      setMonths(await adminApi.months())
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  const edit = (purchase: PurchaseDto) => {
    setNotice(null)
    setForm({
      id: purchase.id,
      purchaseDate: purchase.purchaseDate,
      amount: moneyInputText(purchase.amount),
      title: purchase.title,
      sellerName: purchase.sellerName ?? '',
      notes: purchase.notes ?? '',
    })
  }

  const remove = (purchase: PurchaseDto) => {
    if (!window.confirm(`«${purchase.title}» به مبلغ ${formatMoney(purchase.amount)} حذف شود؟`)) return
    void removeAction.run(async () => {
      try {
        await adminApi.deletePurchase(purchase.id)
        if (form.id === purchase.id) setForm(emptyForm())
        await load(month)
        setMonths(await adminApi.months())
      } catch (reason) { setError(errorText(reason)) }
    })
  }

  return <PageFrame
    title="خریدها"
    description="هر خرید یک سطر است: تاریخ، مبلغ و یک توضیح کوتاه. ماه هر خرید از روی تاریخ آن مشخص می‌شود."
    actions={<MonthSelect value={month} onChange={setMonth} months={months} />}
  >
    <Message error={error} />
    {notice && <Message>{notice}</Message>}

    <section className="panel admin-controls">
      <form className="form-grid purchase-form compact-entry-form" onSubmit={submit}>
        <DateField label="تاریخ خرید" value={form.purchaseDate}
          onChange={(value) => setForm({ ...form, purchaseDate: value })} />
        <AmountField label="مبلغ (تومان)" value={form.amount} placeholder="4,850,000"
          onChange={(value) => setForm({ ...form, amount: value })} />
        <label className="field">عنوان
          <input value={form.title} maxLength={200} placeholder="خرید بازار"
            onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="field">فروشگاه یا فروشنده
          <input value={form.sellerName} maxLength={150} placeholder="اختیاری"
            onChange={(event) => setForm({ ...form, sellerName: event.target.value })} />
        </label>
        <label className="field">یادداشت
          <input value={form.notes} maxLength={1000} placeholder="اختیاری"
            onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="form-actions">
          <button className="primary" disabled={busy || !canSave}>
            {busy ? 'در حال ذخیره…' : form.id == null ? '+ ثبت خرید' : 'ذخیره تغییرات'}
          </button>
          {form.id != null && <button type="button" className="secondary"
            onClick={() => setForm(emptyForm())}>انصراف</button>}
        </div>
      </form>
    </section>

    <section className="panel compact-grid-panel">
      <div className="table-panel-head">
        <h2>خریدهای {data?.title ?? ''}</h2>
        <span>جمع خرید این ماه: {formatMoney(data?.totalAmount ?? 0)}</span>
      </div>
      <ListState loading={loading} error={error} isEmpty={(data?.purchases.length ?? 0) === 0}
        emptyText="برای این ماه خریدی ثبت نشده است." />
      {(data?.purchases.length ?? 0) > 0 && <>
        <div className="table-wrap"><table>
          <thead><tr><RowNumberHead />
            <th>تاریخ</th><th>عنوان</th><th>فروشنده</th><th>مبلغ</th><th>یادداشت</th><th>عملیات</th>
          </tr></thead>
          <tbody>{paged.visible.map((purchase, index) => <tr key={purchase.id}>
            <RowNumberCell offset={paged.rowOffset} index={index} />
            <td>{formatPersianDate(purchase.purchaseDate)}</td>
            <td>{purchase.title}</td>
            <td>{purchase.sellerName || '—'}</td>
            <td>{formatMoney(purchase.amount)}</td>
            <td>{purchase.notes || '—'}</td>
            <td className="actions">
              <button type="button" onClick={() => edit(purchase)}>ویرایش</button>
              <button type="button" className="danger" disabled={removeAction.busy}
                onClick={() => remove(purchase)}>حذف</button>
            </td>
          </tr>)}</tbody>
        </table></div>
        <Pager {...paged} />
      </>}
    </section>
  </PageFrame>
}

/** «۱٫۲ میلیون»-style tick labels; full amounts live in the hover tooltip. */
export function compactToman(value: number): string {
  if (value >= 1_000_000) return `${formatNumber(Math.round(value / 100_000) / 10)} میلیون`
  if (value >= 1_000) return `${formatNumber(Math.round(value / 1_000))} هزار`
  return formatNumber(value)
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10
  return step * magnitude
}

/**
 * Sales against purchases, two thin bars per day, read right to left like the rest of the page:
 * day 1 sits at the right edge. A value axis with three gridlines gives the bars a scale, and
 * hovering a day shows both amounts. Plain SVG; the month's shape is the whole message.
 */
export function MonthTrend({ daily }: { daily: MonthlyDailyPointDto[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const top = useMemo(
    () => niceCeiling(Math.max(1, ...daily.map((point) => Math.max(point.foodSales, point.purchases)))),
    [daily],
  )
  if (daily.length === 0) return null
  const width = 900
  const height = 220
  const axis = 78
  const plotTop = 10
  const plotBottom = 190
  const plotHeight = plotBottom - plotTop
  const slot = (width - axis) / daily.length
  const bar = Math.max(3, Math.min(9, slot / 2 - 2))
  const xOf = (index: number) => width - axis - (index + 1) * slot
  const yOf = (value: number) => plotBottom - (value / top) * plotHeight
  const ticks = [0, top / 2, top]
  const point = hovered == null ? null : daily[hovered]
  return <figure className="month-trend">
    <figcaption>
      <span className="month-trend-key sales" /> فروش غذا
      <span className="month-trend-key purchases" /> خرید
    </figcaption>
    <div className="month-trend-plot" onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label="نمودار روزانه فروش و خرید این ماه">
        {ticks.map((tick) => <g key={tick} className="month-trend-grid">
          <line x1={0} x2={width - axis} y1={yOf(tick)} y2={yOf(tick)} />
          <text x={width - axis + 8} y={yOf(tick) + 4}>{compactToman(tick)}</text>
        </g>)}
        {daily.map((day, index) => {
          const x = xOf(index)
          const sales = Math.max(day.foodSales > 0 ? 2 : 0, plotBottom - yOf(day.foodSales))
          const purchases = Math.max(day.purchases > 0 ? 2 : 0, plotBottom - yOf(day.purchases))
          const centre = x + slot / 2
          return <g key={day.date} className={hovered === index ? 'is-hovered' : undefined}>
            <rect className="month-trend-hit" x={x} y={plotTop} width={slot} height={plotHeight + 24}
              onMouseEnter={() => setHovered(index)} />
            {/* Sales on the right of each pair, the side the day starts reading from. */}
            <rect className="bar-sales" x={centre + 1} y={plotBottom - sales} width={bar} height={sales} rx={2} />
            <rect className="bar-purchases" x={centre - 1 - bar} y={plotBottom - purchases} width={bar} height={purchases} rx={2} />
            {(day.dayOfMonth === 1 || day.dayOfMonth % 5 === 0) && <text x={centre} y={height - 10} textAnchor="middle" className="bar-label">
              {formatNumber(day.dayOfMonth)}
            </text>}
          </g>
        })}
      </svg>
      {point && hovered != null && <div className="month-trend-tooltip" role="status"
        style={{ right: `${((axis + (hovered + 0.5) * slot) / width) * 100}%` }}>
        <strong>روز {formatNumber(point.dayOfMonth)}</strong>
        <span><i className="month-trend-key sales" /> فروش {formatMoney(point.foodSales)}</span>
        <span><i className="month-trend-key purchases" /> خرید {formatMoney(point.purchases)}</span>
      </div>}
    </div>
  </figure>
}

/** The metric strip both the months page and the dashboard show for a month. */
export function MonthMetrics({ report }: { report: MonthlyReportDto }) {
  const { summary } = report
  return <>
    <div className="metric-grid">
      <article className="metric"><span>فروش غذا (خالص)</span><strong>{formatMoney(summary.foodSales)}</strong></article>
      {summary.refunds > 0 && <article className="metric"><span>استرداد</span><strong>{formatMoney(summary.refunds)}</strong></article>}
      <article className="metric"><span>خریدها</span><strong>{formatMoney(summary.purchases)}</strong></article>
      <article className="metric"><span>فروش منهای خرید</span><strong>{formatMoney(summary.salesMinusPurchases)}</strong></article>
      <article className="metric"><span>نسبت خرید به فروش</span><strong>{percentText(summary.purchaseToSalesPercent)}</strong></article>
      <article className="metric"><span>کارکرد پیک</span><strong>{formatMoney(summary.courierCost)}</strong></article>
      <article className="metric"><span>هزینه ارسال دریافتی</span><strong>{formatMoney(summary.deliveryFees)}</strong></article>
      <article className="metric"><span>حاشیه ارسال</span><strong>{formatMoney(summary.deliveryMargin)}</strong></article>
      <article className="metric"><span>تعداد خرید</span><strong>{formatNumber(summary.purchaseCount)}</strong></article>
    </div>
    <Message>{ratioSentence(summary.purchaseToSalesPercent)}</Message>
    <MonthTrend daily={report.daily} />
  </>
}

/** Browse months, then open one. Nothing has to be created first. */
export function MonthsPage() {
  const [months, setMonths] = useState<MonthListItemDto[]>([])
  const [selected, setSelected] = useState<MonthState>(currentMonth)
  const [report, setReport] = useState<MonthlyReportDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void adminApi.months().then(setMonths).catch((reason) => setError(errorText(reason)))
  }, [])

  useEffect(() => {
    setLoading(true)
    void adminApi.month(selected.year, selected.month)
      .then((value) => { setReport(value); setError(null) })
      .catch((reason) => setError(errorText(reason)))
      .finally(() => setLoading(false))
  }, [selected])

  return <PageFrame
    title="ماه‌ها"
    description="وضعیت هر ماه شمسی؛ ماه‌ها خودکار از روی تاریخ خریدها و سفارش‌ها ساخته می‌شوند."
  >
    <Message error={error} />
    <div className="month-list">
      {months.map((item) => {
        const isSelected = item.year === selected.year && item.month === selected.month
        return <button type="button" key={`${item.year}-${item.month}`}
          className={`month-card ${isSelected ? 'active' : ''}`}
          aria-current={isSelected ? 'true' : undefined}
          onClick={() => setSelected({ year: item.year, month: item.month })}>
          <strong>{item.title}</strong>
          <span>فروش: {formatMoney(item.foodSales)}</span>
          <span>خرید: {formatMoney(item.purchases)}</span>
          <span>نسبت: {percentText(item.purchaseToSalesPercent)}</span>
        </button>
      })}
    </div>
    <section className="panel">
      <div className="table-panel-head"><h2>{report?.summary.title ?? persianMonthNames[selected.month - 1]}</h2></div>
      <ListState loading={loading} error={error} isEmpty={false} emptyText="" />
      {report && <MonthMetrics report={report} />}
    </section>
  </PageFrame>
}
