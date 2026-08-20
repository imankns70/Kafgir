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
  AmountField, DateField, Pager, RowNumberCell, RowNumberHead, useAsyncAction, usePagination,
} from './admin-ui'
import {
  formatMoney as money,
  formatNumber as count,
  formatPersianDate as persianDay,
  formatPersianDateTime as dateTime,
  parseTomanAmount,
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

  return <section className="panel">
    <header className="panel-header">
      <h2>پیک‌ها</h2>
      <p>فهرست افرادی که سفارش‌ها را تحویل می‌دهند. هزینه و نرخ هر روز در صفحه «پیک و هزینه ارسال روزانه» تعیین می‌شود.</p>
    </header>

    <details className="page-guide" open>
      <summary>راهنما</summary>
      <ul>
        <li>هر شماره موبایل فقط برای یک پیک قابل ثبت است.</li>
        <li>غیرفعال کردن پیک او را از انتخاب برای روزهای جدید حذف می‌کند، ولی سفارش‌های گذشته، کارکرد و مانده حساب او دست‌نخورده می‌ماند.</li>
        <li>پیک حذف نمی‌شود؛ سابقه مالی باید همیشه قابل بازبینی بماند.</li>
      </ul>
    </details>

    {error && <div className="form-error" role="alert">{error}</div>}

    <form className="form-grid two-columns" onSubmit={submit}>
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
      <label className="field checkbox-field">
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        فعال
      </label>
      <div className="form-actions">
        <button className="primary-button" disabled={busy}>
          {busy ? 'در حال ذخیره…' : form.id == null ? 'افزودن پیک' : 'ذخیره تغییرات'}
        </button>
        {form.id != null && <button type="button" className="outline-button"
          onClick={() => setForm(emptyCourierForm)}>انصراف</button>}
      </div>
    </form>

    <div className="table-panel">
      <div className="table-panel-head"><h3>پیک‌های ثبت‌شده</h3><span>{count(couriers.length)} مورد</span></div>
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
                <td>{courier.isActive ? 'فعال' : 'غیرفعال'}</td>
                <td>
                  <button type="button" className="outline-button" onClick={() => setForm({
                    id: courier.id,
                    fullName: courier.fullName,
                    mobile: courier.mobile,
                    notes: courier.notes ?? '',
                    isActive: courier.isActive,
                  })}>ویرایش</button>
                  <button type="button" className="outline-button" disabled={toggleAction.busy}
                    onClick={() => toggleActive(courier)}>
                    {togglingId === courier.id ? 'در حال تغییر…' : courier.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...paged} /></>}
    </div>
  </section>
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
          customerDeliveryFee: String(result.configuration.customerDeliveryFee),
          courierPayablePerOrder: String(result.configuration.courierPayablePerOrder),
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
  const customerFee = parseTomanAmount(form.customerDeliveryFee)
  const courierPayable = parseTomanAmount(form.courierPayablePerOrder)
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

  return <section className="panel">
    <header className="panel-header">
      <h2>پیک و هزینه ارسال روزانه</h2>
      <p>تعیین پیک هر روز، هزینه‌ای که از مشتری گرفته می‌شود و مبلغی که بابت هر تحویل به پیک پرداخت می‌شود.</p>
    </header>

    <details className="page-guide" open>
      <summary>راهنما</summary>
      <ul>
        <li>مبنای محاسبه، «روز تحویل» سفارش است، نه روز ثبت آن. سفارشی که امشب برای فردا ثبت شود، پیک و نرخ فردا را می‌گیرد.</li>
        <li>هر روز فقط یک پیکربندی فعال دارد. ذخیره دوباره، پیکربندی قبلی را بایگانی و پیکربندی تازه را جایگزین می‌کند.</li>
        <li>تغییر پیک یا نرخ در میانه روز فقط روی سفارش‌های بعدی اثر دارد؛ سفارش‌های ثبت‌شده مقدار لحظه ثبت خود را نگه می‌دارند.</li>
        <li>«هزینه ارسال برای مشتری» و «مبلغ هر تحویل برای پیک» دو عدد مستقل‌اند و می‌توانند متفاوت باشند.</li>
        <li>اگر برای روزی پیکربندی فعالی وجود نداشته باشد، ثبت سفارش ارسالی برای آن روز ممکن نیست.</li>
      </ul>
    </details>

    {error && <div className="form-error" role="alert">{error}</div>}

    <DateField label="روز تحویل" value={date} onChange={setDate} />

    {activeCouriers.length === 0 && <p className="muted">
      هیچ پیک فعالی ثبت نشده است. ابتدا از صفحه «پیک‌ها» یک پیک اضافه کنید.
    </p>}

    <div className="form-grid two-columns">
      <label className="field">پیک
        <select value={form.courierId} onChange={(e) => setForm({ ...form, courierId: e.target.value })}>
          <option value="">انتخاب کنید</option>
          {activeCouriers.map((courier) => <option key={courier.id} value={courier.id}>
            {courier.fullName} — {courier.mobile}
          </option>)}
        </select>
      </label>
      <AmountField label="هزینه ارسال برای مشتری (تومان)" placeholder="70,000"
        value={form.customerDeliveryFee} invalid={form.customerDeliveryFee !== '' && customerFee === null}
        onChange={(value) => setForm({ ...form, customerDeliveryFee: value })} />
      <AmountField label="مبلغ هر تحویل برای پیک (تومان)" placeholder="70,000"
        value={form.courierPayablePerOrder} invalid={form.courierPayablePerOrder !== '' && courierPayable === null}
        onChange={(value) => setForm({ ...form, courierPayablePerOrder: value })} />
      <div className="form-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={() => void save(true)}>
          {busy ? 'در حال ذخیره…' : 'ذخیره و فعال کردن این روز'}
        </button>
        {day?.configuration && <button type="button" className="outline-button" disabled={busy}
          onClick={() => void save(false)}>غیرفعال کردن این روز</button>}
      </div>
    </div>

    <section className="detail-section">
      <h3>وضعیت {persianDay(date)}</h3>
      {day?.configuration
        ? <dl>
            <div><dt>پیک</dt><dd>{day.configuration.courierFullName} — <bdi dir="ltr">{day.configuration.courierMobile}</bdi></dd></div>
            <div><dt>هزینه ارسال برای مشتری</dt><dd>{money(day.configuration.customerDeliveryFee)}</dd></div>
            <div><dt>مبلغ هر تحویل برای پیک</dt><dd>{money(day.configuration.courierPayablePerOrder)}</dd></div>
            <div><dt>سفارش‌های ثبت‌شده با این تنظیمات</dt><dd>{count(day.snapshottedOrders)}</dd></div>
          </dl>
        : <p className="muted">برای این روز پیک و هزینه ارسال تعیین نشده است؛ ثبت سفارش ارسالی برای این روز ممکن نیست.</p>}
    </section>

    <div className="table-panel">
      <div className="table-panel-head"><h3>روزهای تنظیم‌شده</h3><span>{count(recent.length)} مورد</span></div>
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
                  <button type="button" className="outline-button"
                    onClick={() => setDate(row.deliveryDate)}>باز کردن</button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...pagedRecent} /></>}
    </div>
  </section>
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

  const parsedAmount = parseTomanAmount(amount)

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

  return <section className="panel">
    <header className="panel-header">
      <h2>کارکرد و تسویه پیک‌ها</h2>
      <p>تعداد تحویل موفق، کارکرد، مبلغ تسویه‌شده و مانده حساب هر پیک.</p>
    </header>

    <details className="page-guide" open>
      <summary>راهنما</summary>
      <ul>
        <li>فقط سفارش‌هایی که وضعیت آن‌ها «تحویل شد» است در کارکرد پیک حساب می‌شوند. سفارش در انتظار تایید، تاییدشده، در حال آماده‌سازی، آماده یا لغوشده کارکردی ایجاد نمی‌کند.</li>
        <li>مبلغ هر سفارش همان مبلغی است که در لحظه ثبت آن سفارش ذخیره شده؛ تغییر نرخ روزانه، کارکرد گذشته را عوض نمی‌کند.</li>
        <li>مانده = کارکرد − تسویه‌شده. ثبت تسویه هیچ تغییری در سفارش‌ها ایجاد نمی‌کند.</li>
        <li>مبلغ تسویه نمی‌تواند از مانده حساب بیشتر باشد.</li>
      </ul>
    </details>

    {error && <div className="form-error" role="alert">{error}</div>}
    {notice && <div className="form-hint" role="status">{notice}</div>}

    <div className="table-panel">
      <div className="table-panel-head"><h3>خلاصه حساب پیک‌ها</h3><span>{count(accounts.length)} مورد</span></div>
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
                <td>{account.isActive ? 'فعال' : 'غیرفعال'}</td>
                <td>{count(account.deliveredOrders)}</td>
                <td>{money(account.earnedAmount)}</td>
                <td>{money(account.settledAmount)}</td>
                <td>{money(account.outstandingAmount)}</td>
                <td>
                  <button type="button" className="outline-button" onClick={() => void open(account)}>
                    تسویه و سوابق
                  </button>
                </td>
              </tr>)}
            </tbody>
          </table><Pager {...paged} /></>}
    </div>

    {selected && <div className="table-panel">
      <div className="table-panel-head">
        <h3>{selected.fullName}</h3>
        <span>مانده: {money(selected.outstandingAmount)}</span>
      </div>
      <section className="detail-section">
        <dl>
          <div><dt>تحویل موفق</dt><dd>{count(selected.deliveredOrders)}</dd></div>
          <div><dt>کارکرد</dt><dd>{money(selected.earnedAmount)}</dd></div>
          <div><dt>تسویه‌شده</dt><dd>{money(selected.settledAmount)}</dd></div>
          <div className="detail-total"><dt>مانده</dt><dd>{money(selected.outstandingAmount)}</dd></div>
        </dl>
      </section>

      <div className="form-grid two-columns">
        <AmountField label="مبلغ تسویه (تومان)" placeholder="500,000" value={amount}
          invalid={amount !== '' && (parsedAmount === null || parsedAmount <= 0)}
          hint={`حداکثر تا مانده فعلی: ${money(selected.outstandingAmount)}`}
          onChange={setAmount} />
        <label className="field">توضیح
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="اختیاری" />
        </label>
        <div className="form-actions">
          <button type="button" className="primary-button"
            disabled={busy || selected.outstandingAmount <= 0} onClick={() => void settle()}>
            {busy ? 'در حال ثبت…' : 'ثبت تسویه'}
          </button>
          <button type="button" className="outline-button" onClick={() => setSelected(null)}>بستن</button>
        </div>
      </div>
      {selected.outstandingAmount <= 0 && <p className="muted">مانده‌ای برای تسویه وجود ندارد.</p>}

      <div className="table-panel-head"><h3>سوابق تسویه</h3><span>{count(settlements.length)} مورد</span></div>
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
    </div>}
  </section>
}
