import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type {
  CourierAccountSummaryDto,
  CourierDeliveryDayDto,
  CourierDeliveryDayViewDto,
  CourierDto,
  CourierSettlementDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import {
  AmountField, DateField, Message, PageFrame, Pager, RowNumberCell, RowNumberHead, StatusPill,
  useAsyncAction, usePagination,
} from './admin-ui'
import {
  formatMoney as money,
  formatNumber as count,
  formatPersianDate as persianDay,
  formatPersianDateTime as dateTime,
  moneyInputText,
  parseMoney,
} from './number-format'

/**
 * Courier directory, per-day arrangement, and accounting.
 *
 * The two amounts an operator types on the day page are separate on purpose: «هزینه ارسال برای
 * مشتری» is revenue and «مبلغ هر تحویل برای پیک» is cost. They usually match today, but the system
 * never derives one from the other, so charging less than we pay — or delivering free — needs no
 * code change.
 */

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

const today = () => new Intl.DateTimeFormat('en-CA-u-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

type CourierForm = { id: number | null; fullName: string; mobile: string; notes: string; isActive: boolean }
const emptyCourierForm: CourierForm = { id: null, fullName: '', mobile: '', notes: '', isActive: true }

/** The delivery-person directory. Deactivating never hides a courier's history or unpaid balance. */
export function CouriersPage() {
  const [couriers, setCouriers] = useState<CourierDto[]>([])
  const [form, setForm] = useState<CourierForm>(emptyCourierForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const toggleAction = useAsyncAction()
  const paged = usePagination(couriers)

  const load = useCallback(async () => {
    try { setCouriers(await adminApi.couriers()) }
    catch (reason) { setError(errorText(reason)) }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const value = {
      fullName: form.fullName.trim(),
      mobile: form.mobile.trim(),
      notes: form.notes.trim() || null,
      isActive: form.isActive,
    }
    try {
      if (form.id == null) await adminApi.createCourier(value)
      else await adminApi.updateCourier(form.id, value)
      setForm(emptyCourierForm)
      await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  const toggleActive = (courier: CourierDto) => {
    setTogglingId(courier.id)
    void toggleAction.run(async () => {
      try {
        await adminApi.setCourierActive(courier.id, !courier.isActive)
        await load()
      } catch (reason) { setError(errorText(reason)) }
      finally { setTogglingId(null) }
    })
  }

  return <PageFrame
    title="پیک‌ها"
    description="ثبت و ویرایش پیک‌ها؛ غیرفعال‌سازی، سوابق سفارش و حساب قبلی را تغییر نمی‌دهد."
  >
    <Message error={error} />

    <form className="panel form-grid compact-entry-form courier-entry-form" onSubmit={submit}>
      <label className="field">نام و نام خانوادگی
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required maxLength={150} placeholder="علی رضایی" />
      </label>
      <label className="field">شماره موبایل
        <input value={form.mobile} dir="ltr" onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          required maxLength={30} placeholder="09121234567" />
      </label>
      <label className="field">یادداشت
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          maxLength={1000} placeholder="اختیاری" />
      </label>
      <label className="switch">
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        فعال
      </label>
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          {busy ? 'در حال ذخیره…' : form.id == null ? 'افزودن پیک' : 'ذخیره تغییرات'}
        </button>
        {form.id != null && <button type="button"
          onClick={() => setForm(emptyCourierForm)}>انصراف</button>}
      </div>
    </form>

    <div className="panel table-wrap compact-grid-panel">
      <div className="table-summary"><strong>پیک‌های ثبت‌شده</strong><span>{count(couriers.length)} مورد</span></div>
      {couriers.length === 0
        ? <p className="muted">هنوز پیکی ثبت نشده است.</p>
        : <><table>
            <thead><tr><RowNumberHead />
              <th>نام</th><th>موبایل</th><th>یادداشت</th><th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {paged.visible.map((courier, index) => <tr key={courier.id}>
                <RowNumberCell offset={paged.rowOffset} index={index} />
                <td>{courier.fullName}</td>
                <td dir="ltr">{courier.mobile}</td>
                <td>{courier.notes || '—'}</td>
                <td><StatusPill active={courier.isActive} /></td>
                <td className="actions">
                  <button type="button" onClick={() => setForm({
                    id: courier.id,
                    fullName: courier.fullName,
                    mobile: courier.mobile,
                    notes: courier.notes ?? '',
                    isActive: courier.isActive,
                  })}>ویرایش</button>
                  <button type="button" disabled={toggleAction.busy}
                    onClick={() => toggleActive(courier)}>
                    {togglingId === courier.id ? 'در حال تغییر…' : courier.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...paged} /></>}
    </div>
  </PageFrame>
}

type DayForm = { courierId: string; customerDeliveryFee: string; courierPayablePerOrder: string }
const emptyDayForm: DayForm = { courierId: '', customerDeliveryFee: '', courierPayablePerOrder: '' }

/** One date's courier and its two prices. Saving never touches orders already placed for that date. */
export function CourierDaysPage() {
  const [date, setDate] = useState(today())
  const [day, setDay] = useState<CourierDeliveryDayViewDto | null>(null)
  const [couriers, setCouriers] = useState<CourierDto[]>([])
  const [recent, setRecent] = useState<CourierDeliveryDayDto[]>([])
  const [form, setForm] = useState<DayForm>(emptyDayForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pagedRecent = usePagination(recent)

  const loadDay = useCallback(async (value: string) => {
    try {
      const result = await adminApi.courierDay(value)
      setDay(result)
      setForm(result.configuration
        ? {
          courierId: String(result.configuration.courierId),
          customerDeliveryFee: moneyInputText(result.configuration.customerDeliveryFee),
          courierPayablePerOrder: moneyInputText(result.configuration.courierPayablePerOrder),
        }
        : emptyDayForm)
    } catch (reason) { setError(errorText(reason)) }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const [courierList, days] = await Promise.all([adminApi.couriers(), adminApi.courierDays()])
        setCouriers(courierList)
        setRecent(days)
      } catch (reason) { setError(errorText(reason)) }
    })()
  }, [])

  useEffect(() => { void loadDay(date) }, [date, loadDay])

  const activeCouriers = couriers.filter((courier) => courier.isActive)
  const customerFee = parseMoney(form.customerDeliveryFee)
  const courierPayable = parseMoney(form.courierPayablePerOrder)
  const amountsValid = customerFee !== null && courierPayable !== null
  const courierId = Number(form.courierId) || 0

  const save = async (isActive: boolean) => {
    setError(null)
    if (isActive && !courierId) return setError('پیک این روز را انتخاب کنید.')
    if (isActive && !amountsValid) return setError('هزینه ارسال و مبلغ هر تحویل باید عددی صحیح و نامنفی به تومان باشند.')
    setBusy(true)
    try {
      const result = await adminApi.saveCourierDay({
        deliveryDate: date,
        courierId: courierId || (day?.configuration?.courierId ?? 0),
        customerDeliveryFee: customerFee ?? 0,
        courierPayablePerOrder: courierPayable ?? 0,
        isActive,
      })
      setDay(result)
      setRecent(await adminApi.courierDays())
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void save(true)
  }

  return <PageFrame
    title="پیک و هزینه ارسال روزانه"
    description="پیک و دو مبلغ مستقل هر روز بر اساس تاریخ تحویل تعیین می‌شوند؛ تغییرات روی سفارش‌های قبلی اثر ندارد."
  >
    <Message error={error} />

    <form className="panel form-grid compact-entry-form courier-day-entry-form" onSubmit={submit}>
      <DateField label="روز تحویل" value={date} onChange={setDate} />
      <label className="field">پیک
        <select value={form.courierId} onChange={(e) => setForm({ ...form, courierId: e.target.value })}>
          <option value="">انتخاب کنید</option>
          {activeCouriers.map((courier) => <option key={courier.id} value={courier.id}>
            {courier.fullName} — {courier.mobile}
          </option>)}
        </select>
      </label>
      <AmountField label="هزینه ارسال برای مشتری (تومان)" placeholder="70,000"
        value={form.customerDeliveryFee}
        onChange={(value) => setForm({ ...form, customerDeliveryFee: value })} />
      <AmountField label="مبلغ هر تحویل برای پیک (تومان)" placeholder="70,000"
        value={form.courierPayablePerOrder}
        onChange={(value) => setForm({ ...form, courierPayablePerOrder: value })} />
      <div className="form-actions">
        <button className="primary" disabled={busy || activeCouriers.length === 0}>
          {busy ? 'در حال ذخیره…' : 'ذخیره و فعال کردن این روز'}
        </button>
        {day?.configuration && <button type="button" disabled={busy}
          onClick={() => void save(false)}>غیرفعال کردن این روز</button>}
      </div>
      <p className={`compact-form-note ${day?.configuration ? 'success' : 'warning'}`}>
        {activeCouriers.length === 0
          ? 'ابتدا در صفحه «پیک‌ها» یک پیک فعال ثبت کنید.'
          : day?.configuration
            ? `${persianDay(date)} فعال است؛ ${count(day.snapshottedOrders)} سفارش با تنظیمات ثبت‌شده این روز وجود دارد.`
            : `${persianDay(date)} هنوز پیک و هزینه فعال ندارد.`}
      </p>
    </form>

    <div className="panel table-wrap compact-grid-panel">
      <div className="table-summary"><strong>روزهای تنظیم‌شده</strong><span>{count(recent.length)} مورد</span></div>
      {recent.length === 0
        ? <p className="muted">هنوز روزی تنظیم نشده است.</p>
        : <><table>
            <thead><tr><RowNumberHead />
              <th>روز</th><th>پیک</th><th>هزینه مشتری</th><th>مبلغ پیک</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {pagedRecent.visible.map((row, index) => <tr key={row.id}>
                <RowNumberCell offset={pagedRecent.rowOffset} index={index} />
                <td>{persianDay(row.deliveryDate)}</td>
                <td>{row.courierFullName}</td>
                <td>{money(row.customerDeliveryFee)}</td>
                <td>{money(row.courierPayablePerOrder)}</td>
                <td>
                  <button type="button"
                    onClick={() => setDate(row.deliveryDate)}>باز کردن</button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...pagedRecent} /></>}
    </div>
  </PageFrame>
}

/**
 * Courier work and settlement.
 *
 * Every figure here is derived server-side: «کارکرد» sums the payable snapshots of orders that are
 * actually Delivered, «تسویه‌شده» sums the settlement records, and «مانده» is the difference.
 * Registering a settlement adds a record — it never edits what an order says the courier earned.
 */
export function CourierAccountingPage() {
  const [accounts, setAccounts] = useState<CourierAccountSummaryDto[]>([])
  const [selected, setSelected] = useState<CourierAccountSummaryDto | null>(null)
  const [settlements, setSettlements] = useState<CourierSettlementDto[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const paged = usePagination(accounts)

  const load = useCallback(async () => {
    try { setAccounts(await adminApi.courierAccounts()) }
    catch (reason) { setError(errorText(reason)) }
  }, [])

  useEffect(() => { void load() }, [load])

  const open = async (account: CourierAccountSummaryDto) => {
    setSelected(account)
    setAmount('')
    setNote('')
    setNotice(null)
    try { setSettlements(await adminApi.courierSettlements(account.courierId)) }
    catch (reason) { setError(errorText(reason)) }
  }

  const parsedAmount = parseMoney(amount)

  const settle = async () => {
    if (!selected) return
    setError(null)
    setNotice(null)
    if (parsedAmount === null || parsedAmount <= 0) return setError('مبلغ تسویه باید عددی صحیح و بیشتر از صفر باشد.')
    setBusy(true)
    try {
      const updated = await adminApi.settleCourier({
        courierId: selected.courierId,
        amount: parsedAmount,
        note: note.trim() || null,
      })
      setSelected(updated)
      setAmount('')
      setNote('')
      setNotice(`تسویه ${money(parsedAmount)} ثبت شد. مانده جدید: ${money(updated.outstandingAmount)}`)
      setSettlements(await adminApi.courierSettlements(updated.courierId))
      await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  const submitSettlement = (event: FormEvent) => {
    event.preventDefault()
    void settle()
  }

  return <PageFrame
    title="کارکرد و تسویه پیک‌ها"
    description="کارکرد فقط از سفارش‌های تحویل‌شده محاسبه می‌شود؛ جزئیات و ثبت تسویه در پنجره همان پیک باز می‌شود."
  >
    <Message error={error} />
    {notice && <Message>{notice}</Message>}

    <div className="panel table-wrap compact-grid-panel">
      <div className="table-summary"><strong>خلاصه حساب پیک‌ها</strong><span>{count(accounts.length)} مورد</span></div>
      {accounts.length === 0
        ? <p className="muted">هنوز پیکی ثبت نشده است.</p>
        : <><table>
            <thead><tr><RowNumberHead />
              <th>نام</th><th>وضعیت</th><th>تحویل موفق</th><th>کارکرد</th><th>تسویه‌شده</th><th>مانده</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {paged.visible.map((account, index) => <tr key={account.courierId}>
                <RowNumberCell offset={paged.rowOffset} index={index} />
                <td>{account.fullName}</td>
                <td><StatusPill active={account.isActive} /></td>
                <td>{count(account.deliveredOrders)}</td>
                <td>{money(account.earnedAmount)}</td>
                <td>{money(account.settledAmount)}</td>
                <td>{money(account.outstandingAmount)}</td>
                <td>
                  <button type="button" onClick={() => void open(account)}>
                    تسویه و سوابق
                  </button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...paged} /></>}
    </div>

    {selected && <div className="admin-dialog-backdrop">
      <section className="admin-dialog-card settlement-dialog" role="dialog" aria-modal="true"
        aria-labelledby="settlement-dialog-title">
        <header className="admin-dialog-header">
          <div><h2 id="settlement-dialog-title">تسویه {selected.fullName}</h2>
            <p>مانده فعلی: <strong>{money(selected.outstandingAmount)}</strong></p></div>
          <button type="button" onClick={() => setSelected(null)}>بستن</button>
        </header>

        <dl className="settlement-summary">
          <div><dt>تحویل موفق</dt><dd>{count(selected.deliveredOrders)}</dd></div>
          <div><dt>کارکرد</dt><dd>{money(selected.earnedAmount)}</dd></div>
          <div><dt>تسویه‌شده</dt><dd>{money(selected.settledAmount)}</dd></div>
          <div><dt>مانده</dt><dd>{money(selected.outstandingAmount)}</dd></div>
        </dl>

        <form className="form-grid compact-entry-form settlement-entry-form" onSubmit={submitSettlement}>
        <AmountField label="مبلغ تسویه (تومان)" placeholder="500,000" value={amount}
          hint={`حداکثر تا مانده فعلی: ${money(selected.outstandingAmount)}`}
          onChange={setAmount} />
        <label className="field">توضیح
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="اختیاری" />
        </label>
        <div className="form-actions">
          <button className="primary" disabled={busy || selected.outstandingAmount <= 0}>
            {busy ? 'در حال ثبت…' : 'ثبت تسویه'}
          </button>
        </div>
        </form>
      {selected.outstandingAmount <= 0 && <p className="muted">مانده‌ای برای تسویه وجود ندارد.</p>}

        <div className="table-wrap settlement-history">
          <div className="table-summary"><strong>سوابق تسویه</strong><span>{count(settlements.length)} مورد</span></div>
          {settlements.length === 0
            ? <p className="muted">هنوز تسویه‌ای ثبت نشده است.</p>
            : <table>
            <thead><tr><th>زمان</th><th>مبلغ</th><th>توضیح</th></tr></thead>
            <tbody>{settlements.map((row) => <tr key={row.id}>
              <td>{dateTime(row.settledAt)}</td>
              <td>{money(row.amount)}</td>
              <td>{row.note || '—'}</td>
            </tr>)}</tbody>
          </table>}
        </div>
      </section>
    </div>}
  </PageFrame>
}
