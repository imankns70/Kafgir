import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AdminDeliveryDayDto, AdminDeliveryTimeSlotDto } from '@kafgir/contracts'
import { DeliverySlotUnavailableReason } from '@kafgir/contracts'
import { adminApi } from './api'
import { PersianDatePicker } from './PersianDatePicker'

const adminReasonLabels: Record<DeliverySlotUnavailableReason, string> = {
  [DeliverySlotUnavailableReason.Inactive]: 'غیرفعال در تنظیمات پایه',
  [DeliverySlotUnavailableReason.DisabledForDate]: 'غیرفعال برای این روز',
  [DeliverySlotUnavailableReason.CutoffPassed]: 'مهلت ثبت گذشته است',
  [DeliverySlotUnavailableReason.CapacityFull]: 'ظرفیت تکمیل است',
}

const today = () => new Intl.DateTimeFormat('en-CA-u-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const window_ = (start: string, end: string) => `${start} تا ${end}`

type SlotForm = {
  id: number | null
  title: string
  startTime: string
  endTime: string
  sortOrder: string
  orderCutoffMinutesBeforeStart: string
  isActive: boolean
}

const emptySlotForm: SlotForm = {
  id: null, title: '', startTime: '12:00', endTime: '14:00',
  sortOrder: '0', orderCutoffMinutesBeforeStart: '60', isActive: true,
}

/** Master data: the windows Kafgir delivers in. Edited rarely, reused every day. */
export function DeliverySlotsPage() {
  const [slots, setSlots] = useState<AdminDeliveryTimeSlotDto[]>([])
  const [form, setForm] = useState<SlotForm>(emptySlotForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setSlots(await adminApi.deliverySlots()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'دریافت بازه‌ها ممکن نشد.') }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const value = {
      title: form.title.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      sortOrder: Number(form.sortOrder) || 0,
      orderCutoffMinutesBeforeStart: Number(form.orderCutoffMinutesBeforeStart) || 0,
      isActive: form.isActive,
    }
    try {
      if (form.id == null) await adminApi.createDeliverySlot(value)
      else await adminApi.updateDeliverySlot(form.id, value)
      setForm(emptySlotForm)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ذخیره بازه ممکن نشد.')
    } finally { setBusy(false) }
  }

  const toggleActive = async (slot: AdminDeliveryTimeSlotDto) => {
    try {
      await adminApi.setDeliverySlotActive(slot.id, !slot.isActive)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تغییر وضعیت ممکن نشد.')
    }
  }

  return <section className="panel">
    <header className="panel-header">
      <h2>بازه‌های ارسال</h2>
      <p>ساعت‌هایی که سفارش‌ها در آن تحویل داده می‌شوند. این تنظیمات پایه است و برای همه روزها به کار می‌رود.</p>
    </header>

    <details className="page-guide" open>
      <summary>راهنما</summary>
      <ul>
        <li>«مهلت ثبت» یعنی چند دقیقه پیش از شروع بازه، سفارش‌گیری برای آن بازه بسته می‌شود. مثلاً بازه ۱۲:۰۰ با مهلت ۶۰ دقیقه، ساعت ۱۱:۰۰ بسته می‌شود.</li>
        <li>بازه‌ها نباید با هم هم‌پوشانی داشته باشند؛ در صورت هم‌پوشانی ذخیره انجام نمی‌شود.</li>
        <li>ظرفیت هر روز جداگانه در صفحه «ظرفیت ارسال روزانه» تنظیم می‌شود. اینجا فقط ساعت‌ها تعریف می‌شوند.</li>
        <li>غیرفعال کردن یک بازه آن را از سفارش‌های جدید حذف می‌کند، ولی سفارش‌های قبلی دست‌نخورده می‌مانند.</li>
      </ul>
    </details>

    {error && <div className="form-error" role="alert">{error}</div>}

    <form className="form-grid two-columns" onSubmit={submit}>
      <label className="field">عنوان
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="ظهر" required maxLength={100} />
      </label>
      <label className="field">ترتیب نمایش
        <input type="number" min={0} value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
      </label>
      <label className="field">ساعت شروع
        <input type="time" dir="ltr" value={form.startTime} required
          onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      </label>
      <label className="field">ساعت پایان
        <input type="time" dir="ltr" value={form.endTime} required
          onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      </label>
      <label className="field">مهلت ثبت (دقیقه پیش از شروع)
        <input type="number" min={0} max={1440} value={form.orderCutoffMinutesBeforeStart}
          onChange={(e) => setForm({ ...form, orderCutoffMinutesBeforeStart: e.target.value })} />
      </label>
      <label className="field checkbox-field">
        <input type="checkbox" checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        فعال
      </label>
      <div className="form-actions">
        <button className="primary-button" disabled={busy}>
          {form.id == null ? 'افزودن بازه' : 'ذخیره تغییرات'}
        </button>
        {form.id != null && <button type="button" className="outline-button"
          onClick={() => setForm(emptySlotForm)}>انصراف</button>}
      </div>
    </form>

    <div className="table-panel">
      <div className="table-panel-head"><h3>بازه‌های تعریف‌شده</h3><span>{slots.length} مورد</span></div>
      {slots.length === 0
        ? <p className="muted">هنوز بازه‌ای تعریف نشده است.</p>
        : <table>
            <thead><tr>
              <th>عنوان</th><th>بازه</th><th>مهلت ثبت</th><th>ترتیب</th><th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {slots.map((slot) => <tr key={slot.id}>
                <td>{slot.title}</td>
                <td dir="ltr">{window_(slot.startTime, slot.endTime)}</td>
                <td>{slot.orderCutoffMinutesBeforeStart} دقیقه</td>
                <td>{slot.sortOrder}</td>
                <td>{slot.isActive ? 'فعال' : 'غیرفعال'}</td>
                <td>
                  <button type="button" className="outline-button" onClick={() => setForm({
                    id: slot.id,
                    title: slot.title,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    sortOrder: String(slot.sortOrder),
                    orderCutoffMinutesBeforeStart: String(slot.orderCutoffMinutesBeforeStart),
                    isActive: slot.isActive,
                  })}>ویرایش</button>
                  <button type="button" className="outline-button" onClick={() => void toggleActive(slot)}>
                    {slot.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>)}
            </tbody>
          </table>}
    </div>
  </section>
}

/** Per-day overrides. Absent row means the window follows its master setting with no order limit. */
export function DeliveryDaysPage() {
  const [date, setDate] = useState(today())
  const [day, setDay] = useState<AdminDeliveryDayDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const load = useCallback(async (value: string) => {
    try {
      const result = await adminApi.deliveryDay(value)
      setDay(result)
      setDrafts(Object.fromEntries(result.slots.map((slot) => [
        slot.slotId, slot.capacityOrders == null ? '' : String(slot.capacityOrders),
      ])))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت وضعیت روز ممکن نشد.')
    }
  }, [])

  useEffect(() => { void load(date) }, [date, load])

  const save = async (slotId: number, isAvailable: boolean) => {
    setError(null)
    const raw = (drafts[slotId] ?? '').trim()
    try {
      await adminApi.setDeliveryDayOverride({
        deliveryDate: date,
        deliveryTimeSlotId: slotId,
        isAvailable,
        capacityOrders: raw === '' ? null : Number(raw),
      })
      await load(date)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ذخیره تنظیمات روز ممکن نشد.')
    }
  }

  return <section className="panel">
    <header className="panel-header">
      <h2>ظرفیت ارسال روزانه</h2>
      <p>فعال یا غیرفعال کردن بازه‌ها و تعیین سقف سفارش برای یک روز مشخص.</p>
    </header>

    <details className="page-guide" open>
      <summary>راهنما</summary>
      <ul>
        <li>اگر برای یک روز چیزی ثبت نکنید، همه بازه‌های فعال با ظرفیت نامحدود در دسترس مشتری هستند.</li>
        <li>ظرفیت خالی یعنی بدون سقف. عدد یعنی حداکثر همان تعداد سفارش برای آن بازه در آن روز.</li>
        <li>ظرفیت ارسال با ظرفیت پخت غذا فرق دارد؛ هر سفارش باید هر دو را داشته باشد.</li>
        <li>سفارش لغوشده جای خود را در بازه آزاد می‌کند.</li>
      </ul>
    </details>

    {error && <div className="form-error" role="alert">{error}</div>}

    <label className="field">روز
      <PersianDatePicker value={date} onChange={setDate} />
    </label>

    <div className="table-panel">
      <div className="table-panel-head">
        <h3>بازه‌های این روز</h3><span>{day?.slots.length ?? 0} مورد</span>
      </div>
      {!day || day.slots.length === 0
        ? <p className="muted">بازه‌ای تعریف نشده است. ابتدا از صفحه «بازه‌های ارسال» بازه بسازید.</p>
        : <table>
            <thead><tr>
              <th>عنوان</th><th>بازه</th><th>وضعیت این روز</th><th>ظرفیت</th><th>ثبت‌شده</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {day.slots.map((slot) => <tr key={slot.slotId}>
                <td>{slot.title}</td>
                <td dir="ltr">{window_(slot.startTime, slot.endTime)}</td>
                <td>
                  {slot.isAvailable ? 'فعال' : 'غیرفعال'}
                  {!slot.isActiveGlobally && <small className="muted"> (در تنظیمات پایه غیرفعال است)</small>}
                  {!slot.hasOverride && <small className="muted"> — پیش‌فرض</small>}
                  {/* The switch above is what you control; this is what the customer actually sees. */}
                  {slot.unavailableReason !== null && <small className="muted">
                    {' '}— برای مشتری: {adminReasonLabels[slot.unavailableReason]}
                  </small>}
                </td>
                <td>
                  <input type="number" min={0} placeholder="بدون سقف" value={drafts[slot.slotId] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [slot.slotId]: e.target.value })} />
                </td>
                <td>{slot.usedOrders}</td>
                <td>
                  <button type="button" className="outline-button"
                    onClick={() => void save(slot.slotId, true)}>ذخیره و فعال</button>
                  <button type="button" className="outline-button"
                    onClick={() => void save(slot.slotId, false)}>غیرفعال کردن</button>
                </td>
              </tr>)}
            </tbody>
          </table>}
    </div>
  </section>
}
