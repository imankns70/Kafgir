import { useCallback, useEffect, useState } from 'react'
import type {
  DeliveryMethodSettingDto,
  PaymentMethodSettingDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { AmountField, ListState, Message, PageFrame } from './admin-ui'
import { formatAmountInput, parseAmount } from './number-format'

/**
 * Checkout configuration.
 *
 * These are not master data. The set of rows is fixed by the `PaymentMethod` / `DeliveryMethod`
 * enums — an operator cannot invent a payment method, because each one implies code that handles it.
 * What is editable is how the business presents and prices them: the customer-facing title, which
 * channel may offer them, and for delivery the fee and minimum order value. That is configuration of
 * the ordering system, so it lives under «تنظیمات» rather than «اطلاعات پایه».
 */

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

/**
 * Money fields are held as text while editing so clearing the box does not silently become zero.
 * The parsing and grouping rules live in `number-format` so this screen and the courier screens
 * cannot drift into two different ideas of what «۷۰٬۰۰۰» or «70,000» means.
 */
const amountText = (value: number) => formatAmountInput(value)

type ChannelFieldsProps = {
  isCustomerEnabled: boolean
  isManualEnabled: boolean
  onChange: (patch: { isCustomerEnabled?: boolean; isManualEnabled?: boolean }) => void
}

function ChannelFields({ isCustomerEnabled, isManualEnabled, onChange }: ChannelFieldsProps) {
  return <>
    <label className="switch"><input type="checkbox" checked={isCustomerEnabled}
      onChange={(event) => onChange({ isCustomerEnabled: event.target.checked })} />نمایش در وب مشتری</label>
    <label className="switch"><input type="checkbox" checked={isManualEnabled}
      onChange={(event) => onChange({ isManualEnabled: event.target.checked })} />قابل انتخاب در سفارش دستی</label>
  </>
}

export function PaymentMethodsPage() {
  const [rows, setRows] = useState<PaymentMethodSettingDto[]>([])
  const [drafts, setDrafts] = useState<Record<number, PaymentMethodSettingDto>>({})
  const [loading, setLoading] = useState(true)
  const [savingMethod, setSavingMethod] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.paymentMethods()
      setRows(data)
      setDrafts(Object.fromEntries(data.map((item) => [item.method, item])))
      setError(null)
    } catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = (method: number, value: Partial<PaymentMethodSettingDto>) =>
    setDrafts((current) => ({ ...current, [method]: { ...current[method]!, ...value } }))

  const isDirty = (method: number) =>
    JSON.stringify(drafts[method]) !== JSON.stringify(rows.find((row) => row.method === method))

  const save = async (method: number) => {
    const draft = drafts[method]
    if (!draft) return
    setSavingMethod(method); setNotice(null)
    try {
      await adminApi.updatePaymentMethod(draft.method, {
        title: draft.title, description: draft.description,
        isCustomerEnabled: draft.isCustomerEnabled, isManualEnabled: draft.isManualEnabled,
        displayOrder: draft.displayOrder,
      })
      setError(null); setNotice(`«${draft.title}» ذخیره شد.`)
      await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setSavingMethod(null) }
  }

  return <PageFrame
    title="روش‌های پرداخت"
    description="تعیین کنید هر روش پرداخت با چه عنوانی و در کدام کانال به مشتری یا اپراتور نمایش داده شود."
  >
    <Message error={error} />
    {notice && <Message>{notice}</Message>}
    <Message>فهرست روش‌ها ثابت است؛ هر روش به پیاده‌سازی مخصوص خود در سامانه وابسته است و افزودن روش تازه نیاز به توسعه دارد.</Message>
    <ListState loading={loading} error={error} isEmpty={rows.length === 0} emptyText="روشی پیکربندی نشده است." />
    <div className="settings-method-grid">{rows.map((row) => {
      const draft = drafts[row.method] ?? row
      return <article className="panel settings-method-card" key={row.method}>
        <label>عنوان<input value={draft.title}
          onChange={(event) => patch(row.method, { title: event.target.value })} /></label>
        <label>توضیح برای مشتری<input value={draft.description ?? ''}
          onChange={(event) => patch(row.method, { description: event.target.value || null })} /></label>
        <label>ترتیب<input type="number" min="0" value={draft.displayOrder}
          onChange={(event) => patch(row.method, { displayOrder: Number(event.target.value) })} /></label>
        <ChannelFields
          isCustomerEnabled={draft.isCustomerEnabled}
          isManualEnabled={draft.isManualEnabled}
          onChange={(value) => patch(row.method, value)}
        />
        <button type="button" className="primary"
          disabled={!isDirty(row.method) || savingMethod === row.method}
          onClick={() => void save(row.method)}>
          {savingMethod === row.method ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
      </article>
    })}</div>
  </PageFrame>
}

export function DeliveryMethodsPage() {
  const [rows, setRows] = useState<DeliveryMethodSettingDto[]>([])
  const [drafts, setDrafts] = useState<Record<number, DeliveryMethodSettingDto>>({})
  const [amounts, setAmounts] = useState<Record<number, { fee: string; minimum: string }>>({})
  const [loading, setLoading] = useState(true)
  const [savingMethod, setSavingMethod] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.deliveryMethods()
      setRows(data)
      setDrafts(Object.fromEntries(data.map((item) => [item.method, item])))
      setAmounts(Object.fromEntries(data.map((item) => [item.method, {
        fee: amountText(item.deliveryFee), minimum: amountText(item.minimumOrderAmount),
      }])))
      setError(null)
    } catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = (method: number, value: Partial<DeliveryMethodSettingDto>) =>
    setDrafts((current) => ({ ...current, [method]: { ...current[method]!, ...value } }))

  const isDirty = (method: number) =>
    JSON.stringify(drafts[method]) !== JSON.stringify(rows.find((row) => row.method === method))

  const invalidAmount = (method: number) => {
    const entry = amounts[method]
    return !entry || parseAmount(entry.fee) === null || parseAmount(entry.minimum) === null
  }

  const save = async (method: number) => {
    const draft = drafts[method]
    const entry = amounts[method]
    if (!draft || !entry) return
    const deliveryFee = parseAmount(entry.fee)
    const minimumOrderAmount = parseAmount(entry.minimum)
    if (deliveryFee === null || minimumOrderAmount === null) {
      setError('هزینه ارسال و حداقل سفارش باید عددی نامنفی باشند.')
      return
    }
    setSavingMethod(method); setNotice(null)
    try {
      await adminApi.updateDeliveryMethod(draft.method, {
        title: draft.title, description: draft.description,
        isCustomerEnabled: draft.isCustomerEnabled, isManualEnabled: draft.isManualEnabled,
        displayOrder: draft.displayOrder, deliveryFee, minimumOrderAmount,
      })
      setError(null); setNotice(`«${draft.title}» ذخیره شد.`)
      await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setSavingMethod(null) }
  }

  return <PageFrame
    title="روش‌های دریافت"
    description="عنوان، کانال نمایش، هزینه ارسال و حداقل مبلغ سفارش برای هر روش دریافت."
  >
    <Message error={error} />
    {notice && <Message>{notice}</Message>}
    <Message>هزینه ارسال به مبلغ سفارش اضافه می‌شود و در همان لحظه ثبت سفارش در فاکتور ذخیره می‌ماند؛ تغییر بعدی آن سفارش‌های گذشته را عوض نمی‌کند.</Message>
    <Message>برای روش‌هایی که با پیک انجام می‌شوند، هزینه ارسال از پیکربندی همان روز تحویل خوانده می‌شود و در این صفحه تعیین نمی‌گردد؛ فقط یک منبع برای قیمت ارسال وجود دارد.</Message>
    <ListState loading={loading} error={error} isEmpty={rows.length === 0} emptyText="روشی پیکربندی نشده است." />
    <div className="settings-method-grid">{rows.map((row) => {
      const draft = drafts[row.method] ?? row
      const entry = amounts[row.method] ?? { fee: '0', minimum: '0' }
      const amountsValid = !invalidAmount(row.method)
      const dirty = isDirty(row.method) ||
        parseAmount(entry.fee) !== row.deliveryFee || parseAmount(entry.minimum) !== row.minimumOrderAmount
      return <article className="panel settings-method-card" key={row.method}>
        <label>عنوان<input value={draft.title}
          onChange={(event) => patch(row.method, { title: event.target.value })} /></label>
        <label>توضیح برای مشتری<input value={draft.description ?? ''}
          onChange={(event) => patch(row.method, { description: event.target.value || null })} /></label>
        {/* A courier method has no fee of its own: its price is a property of the delivery date, set
            on «پیک و هزینه ارسال روزانه». Showing an editable box here would create a second,
            never-consulted fee and leave an operator wondering which one the customer pays. */}
        {row.requiresCourier
          ? <p className="settings-method-note">
              هزینه ارسال این روش برای هر روز جداگانه در صفحه «پیک و هزینه ارسال روزانه» تعیین می‌شود.
            </p>
          : <AmountField label="هزینه ارسال (تومان)" value={entry.fee}
              invalid={parseAmount(entry.fee) === null}
              onChange={(value) => setAmounts((current) => ({
                ...current, [row.method]: { ...entry, fee: value },
              }))} />}
        <AmountField label="حداقل مبلغ سفارش (تومان)" value={entry.minimum}
          invalid={parseAmount(entry.minimum) === null}
          onChange={(value) => setAmounts((current) => ({
            ...current, [row.method]: { ...entry, minimum: value },
          }))} />
        <label>ترتیب<input type="number" min="0" value={draft.displayOrder}
          onChange={(event) => patch(row.method, { displayOrder: Number(event.target.value) })} /></label>
        <ChannelFields
          isCustomerEnabled={draft.isCustomerEnabled}
          isManualEnabled={draft.isManualEnabled}
          onChange={(value) => patch(row.method, value)}
        />
        {!amountsValid && <p className="field-error" role="alert">مقدار عددی نامعتبر است.</p>}
        <button type="button" className="primary"
          disabled={!dirty || !amountsValid || savingMethod === row.method}
          onClick={() => void save(row.method)}>
          {savingMethod === row.method ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
      </article>
    })}</div>
  </PageFrame>
}
