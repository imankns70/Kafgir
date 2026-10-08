import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { OrderStatus, type AdminOrderDetailDto, type DailyMenuDto } from '@kafgir/contracts'
import { adminApi } from './api'
import { formatMoney, formatNumber } from './number-format'

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

/** The kitchen has not started on these, so the basket and address may still change. */
export const isOrderEditable = (status: OrderStatus) =>
  status === OrderStatus.PendingConfirmation || status === OrderStatus.Confirmed

/** Statuses an Owner may take one step back when they were recorded by mistake. */
export const isOrderReopenable = (status: OrderStatus) =>
  status === OrderStatus.Delivered || status === OrderStatus.Cancelled

type Line = { dailyMenuItemId: number; foodName: string; unitPrice: number; quantity: number; isNew: boolean }

type MenuChoice = { id: number; name: string; price: number; remaining: number }

/** What the menu of the order's day offers, Persian rice included as its own line. */
export function menuChoices(menu: DailyMenuDto | null): MenuChoice[] {
  if (!menu) return []
  const dishes = menu.items.map((item) => ({ id: item.id, name: item.foodName, price: item.price, remaining: item.remainingPortions }))
  const rice = menu.persianRice
    ? [{ id: menu.persianRice.menuItemId, name: menu.persianRice.title, price: menu.persianRice.price, remaining: menu.persianRice.remainingPortions }]
    : []
  return [...dishes, ...rice.filter((item) => !dishes.some((dish) => dish.id === item.id))]
}

export function editedSubtotal(lines: Pick<Line, 'unitPrice' | 'quantity'>[]) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
}

export function OrderEditDialog({ order, onClose, onSaved }: {
  order: AdminOrderDetailDto
  onClose: () => void
  onSaved: () => void
}) {
  const [lines, setLines] = useState<Line[]>(() => order.items.map((item) => ({
    dailyMenuItemId: item.dailyMenuItemId, foodName: item.foodName, unitPrice: item.unitPrice,
    quantity: item.quantity, isNew: false,
  })))
  const [fullName, setFullName] = useState(order.customerFullName)
  const [phoneNumber, setPhoneNumber] = useState(order.customerPhoneNumber)
  const [city, setCity] = useState(order.deliveryCity ?? '')
  const [addressLine, setAddressLine] = useState(order.addressLine ?? '')
  const [customerNote, setCustomerNote] = useState(order.customerNote ?? '')
  const [reason, setReason] = useState('')
  const [menu, setMenu] = useState<DailyMenuDto | null>(null)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Orders from before delivery dates were stored were served on the day they were placed.
  const menuDate = order.deliveryDate ?? new Date(order.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
  useEffect(() => {
    void adminApi.menu(menuDate).then(setMenu).catch((reason) => setError(errorText(reason)))
  }, [menuDate])

  const choices = useMemo(() => menuChoices(menu)
    .filter((choice) => !lines.some((line) => line.dailyMenuItemId === choice.id)), [menu, lines])
  const subtotal = editedSubtotal(lines)
  const delta = subtotal - order.subtotalAmount

  const setQuantity = (id: number, quantity: number) =>
    setLines((current) => current.map((line) => line.dailyMenuItemId === id ? { ...line, quantity: Math.max(1, Math.min(100, quantity)) } : line))
  const remove = (id: number) => setLines((current) => current.filter((line) => line.dailyMenuItemId !== id))
  const add = () => {
    const choice = choices.find((item) => item.id === Number(adding))
    if (!choice) return
    setLines((current) => [...current, { dailyMenuItemId: choice.id, foodName: choice.name, unitPrice: choice.price, quantity: 1, isNew: true }])
    setAdding('')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (lines.length === 0) { setError('سفارش دست‌کم یک قلم غذا لازم دارد.'); return }
    setBusy(true)
    setError(null)
    try {
      await adminApi.editOrder(order.id, {
        fullName, phoneNumber,
        city: city || null, addressLine: addressLine || null, customerNote: customerNote || null,
        items: lines.map((line) => ({ dailyMenuItemId: line.dailyMenuItemId, quantity: line.quantity })),
        reason: reason || null,
      })
      onSaved()
    } catch (reason) {
      setError(errorText(reason))
    } finally { setBusy(false) }
  }

  return <div className="invoice-dialog" role="dialog" aria-modal="true" aria-label={`ویرایش سفارش ${order.orderNumber}`}>
    <button type="button" className="invoice-dialog-backdrop" aria-label="بستن" onClick={onClose} />
    <form className="invoice-dialog-card order-edit-card" onSubmit={(event) => void save(event)}>
      <div className="order-edit-head">
        <h2>ویرایش سفارش <span dir="ltr">{order.orderNumber}</span></h2>
        <p>تا پیش از رفتن به آشپزخانه. اقلام موجود با همان قیمت ثبت‌شده می‌مانند؛ غذای تازه با قیمت امروز منو اضافه می‌شود. هزینه ارسال تغییر نمی‌کند.</p>
      </div>

      <section className="order-edit-section">
        <h3>اقلام</h3>
        <table className="order-edit-items">
          <thead><tr><th>غذا</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th><th /></tr></thead>
          <tbody>{lines.map((line) => <tr key={line.dailyMenuItemId}>
            <td className="text-cell">{line.foodName}{line.isNew && <span className="badge open">تازه</span>}</td>
            <td><div className="qty-stepper">
              <button type="button" aria-label={`افزایش ${line.foodName}`} onClick={() => setQuantity(line.dailyMenuItemId, line.quantity + 1)}>+</button>
              <input type="number" min={1} max={100} value={line.quantity} aria-label={`تعداد ${line.foodName}`}
                onChange={(event) => setQuantity(line.dailyMenuItemId, Number(event.target.value) || 1)} />
              <button type="button" aria-label={`کاهش ${line.foodName}`} disabled={line.quantity <= 1}
                onClick={() => setQuantity(line.dailyMenuItemId, line.quantity - 1)}>−</button>
            </div></td>
            <td>{formatMoney(line.unitPrice)}</td>
            <td>{formatMoney(line.unitPrice * line.quantity)}</td>
            <td><button type="button" className="danger" onClick={() => remove(line.dailyMenuItemId)} disabled={lines.length <= 1}>حذف</button></td>
          </tr>)}</tbody>
        </table>
        <div className="order-edit-add">
          <select value={adding} onChange={(event) => setAdding(event.target.value)} aria-label="افزودن غذا از منوی همان روز"
            disabled={choices.length === 0}>
            <option value="">{menu ? 'افزودن غذا از منوی همان روز…' : 'در حال دریافت منوی همان روز…'}</option>
            {choices.map((choice) => <option key={choice.id} value={choice.id} disabled={choice.remaining <= 0}>
              {choice.name} — {formatMoney(choice.price)} ({choice.remaining > 0 ? `${formatNumber(choice.remaining)} پرس مانده` : 'تمام شد'})
            </option>)}
          </select>
          <button type="button" onClick={add} disabled={!adding}>افزودن</button>
        </div>
        <p className="order-edit-total">
          جمع غذا: <strong>{formatMoney(subtotal)}</strong>
          {delta !== 0 && <span className={delta > 0 ? 'up' : 'down'}> ({delta > 0 ? '+' : '−'}{formatMoney(Math.abs(delta))} نسبت به قبل)</span>}
          {' · '}مبلغ کل با ارسال: <strong>{formatMoney(subtotal + order.deliveryFee)}</strong>
        </p>
      </section>

      <section className="order-edit-section form-grid order-edit-contact">
        <h3>مشتری و آدرس</h3>
        <label>نام گیرنده<input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={150} /></label>
        <label>شماره تماس<input dir="ltr" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required maxLength={30} /></label>
        <label>شهر<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} /></label>
        <label className="wide">آدرس<textarea rows={2} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} maxLength={1000} /></label>
        <label className="wide">یادداشت مشتری<textarea rows={2} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} maxLength={1000} /></label>
        <label className="wide">دلیل ویرایش (در گزارش تغییرات ثبت می‌شود)<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="مثلاً مشتری تلفنی یک پرس اضافه خواست" /></label>
      </section>

      {error && <div className="message error">{error}</div>}
      <div className="order-edit-actions">
        <button type="submit" className="primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button>
        <button type="button" onClick={onClose} disabled={busy}>انصراف</button>
      </div>
    </form>
  </div>
}

export function OrderReopenDialog({ order, onClose, onSaved }: {
  order: AdminOrderDetailDto
  onClose: () => void
  onSaved: (status: OrderStatus) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const delivered = order.status === OrderStatus.Delivered
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try { onSaved(await adminApi.reopenOrder(order.id, { reason })) }
    catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }
  return <div className="invoice-dialog" role="dialog" aria-modal="true" aria-label="بازگرداندن وضعیت سفارش">
    <button type="button" className="invoice-dialog-backdrop" aria-label="بستن" onClick={onClose} />
    <form className="invoice-dialog-card order-edit-card order-reopen-card" onSubmit={(event) => void save(event)}>
      <div className="order-edit-head">
        <h2>بازگرداندن وضعیت سفارش <span dir="ltr">{order.orderNumber}</span></h2>
        <p>{delivered
          ? 'سفارش به «آماده تحویل» برمی‌گردد و تا تحویل دوباره در فروش و کارکرد پیک حساب نمی‌شود.'
          : 'سفارش به «در انتظار تأیید» برمی‌گردد. برای رزرو دوباره موجودی باید آن را دوباره تأیید کنید. پرداخت‌هایی که هنگام لغو بسته شدند دوباره باز نمی‌شوند.'}</p>
      </div>
      <label className="order-reopen-reason">دلیل (الزامی؛ در تاریخچه وضعیت ثبت می‌شود)
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={500}
          placeholder={delivered ? 'مثلاً اشتباهی تحویل‌شده زده شد' : 'مثلاً مشتری لغو را پس گرفت'} />
      </label>
      {error && <div className="message error">{error}</div>}
      <div className="order-edit-actions">
        <button type="submit" className="primary" disabled={busy || reason.trim().length < 3}>{busy ? 'در حال ثبت…' : 'بازگرداندن وضعیت'}</button>
        <button type="button" onClick={onClose} disabled={busy}>انصراف</button>
      </div>
    </form>
  </div>
}
