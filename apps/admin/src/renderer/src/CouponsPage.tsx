import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CouponDiscountType, type CouponDto, type CouponWriteRequest } from '@kafgir/contracts'
import { adminApi } from './api'
import { AmountField, DateField, ListState, Message, PageFrame, useAsyncAction } from './admin-ui'
import { formatMoney, formatNumber, formatPersianDate, moneyInputText, parseMoney } from './number-format'

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

type Form = {
  id: number | null
  code: string
  title: string
  discountType: CouponDiscountType
  value: string
  maxDiscount: string
  minOrder: string
  startsOn: string
  endsOn: string
  usageLimit: string
  perCustomerLimit: string
  firstOrderOnly: boolean
  isActive: boolean
}

const emptyForm = (): Form => ({
  id: null, code: '', title: '', discountType: CouponDiscountType.Percent, value: '', maxDiscount: '',
  minOrder: '', startsOn: '', endsOn: '', usageLimit: '', perCustomerLimit: '1', firstOrderOnly: false, isActive: true,
})

const toForm = (coupon: CouponDto): Form => ({
  id: coupon.id,
  code: coupon.code,
  title: coupon.title ?? '',
  discountType: coupon.discountType,
  value: coupon.discountType === CouponDiscountType.Percent ? String(coupon.discountValue) : moneyInputText(coupon.discountValue),
  maxDiscount: coupon.maxDiscountAmount == null ? '' : moneyInputText(coupon.maxDiscountAmount),
  minOrder: coupon.minOrderAmount ? moneyInputText(coupon.minOrderAmount) : '',
  startsOn: coupon.startsOn ?? '',
  endsOn: coupon.endsOn ?? '',
  usageLimit: coupon.usageLimit == null ? '' : String(coupon.usageLimit),
  perCustomerLimit: coupon.perCustomerLimit == null ? '' : String(coupon.perCustomerLimit),
  firstOrderOnly: coupon.firstOrderOnly,
  isActive: coupon.isActive,
})

const wholeOrNull = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed.replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))))
  return Number.isInteger(value) && value > 0 ? value : Number.NaN
}

/** The form as a write request, or the first thing wrong with it. */
export function couponRequest(form: Form): CouponWriteRequest | string {
  const percent = form.discountType === CouponDiscountType.Percent
  const value = percent ? Number(form.value.replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))) : parseMoney(form.value)
  if (!form.code.trim()) return 'کد تخفیف را بنویسید.'
  if (value === null || !Number.isFinite(value) || value <= 0) return 'مقدار تخفیف را درست وارد کنید.'
  if (percent && value > 100) return 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.'
  const usageLimit = wholeOrNull(form.usageLimit)
  const perCustomerLimit = wholeOrNull(form.perCustomerLimit)
  if (Number.isNaN(usageLimit) || Number.isNaN(perCustomerLimit)) return 'سقف استفاده باید عدد صحیح مثبت باشد.'
  const maxDiscount = form.maxDiscount.trim() ? parseMoney(form.maxDiscount) : null
  const minOrder = form.minOrder.trim() ? parseMoney(form.minOrder) : 0
  if ((form.maxDiscount.trim() && !maxDiscount) || minOrder === null) return 'مبلغ‌ها را درست وارد کنید.'
  if (form.startsOn && form.endsOn && form.startsOn > form.endsOn) return 'تاریخ پایان باید پس از تاریخ شروع باشد.'
  return {
    code: form.code.trim(),
    title: form.title.trim() || null,
    discountType: form.discountType,
    discountValue: value,
    maxDiscountAmount: percent ? maxDiscount : null,
    minOrderAmount: minOrder,
    startsOn: form.startsOn || null,
    endsOn: form.endsOn || null,
    usageLimit,
    perCustomerLimit,
    firstOrderOnly: form.firstOrderOnly,
    isActive: form.isActive,
  }
}

export function couponSummary(coupon: Pick<CouponDto, 'discountType' | 'discountValue' | 'maxDiscountAmount' | 'minOrderAmount'>) {
  const amount = coupon.discountType === CouponDiscountType.Percent
    ? `${formatNumber(coupon.discountValue, 1)}٪${coupon.maxDiscountAmount ? ` تا سقف ${formatMoney(coupon.maxDiscountAmount)}` : ''}`
    : formatMoney(coupon.discountValue)
  return coupon.minOrderAmount > 0 ? `${amount} · برای سفارش از ${formatMoney(coupon.minOrderAmount)}` : amount
}

const validityText = (coupon: CouponDto) => {
  if (!coupon.startsOn && !coupon.endsOn) return 'بدون محدودیت زمانی'
  if (coupon.startsOn && coupon.endsOn) return `${formatPersianDate(coupon.startsOn)} تا ${formatPersianDate(coupon.endsOn)}`
  return coupon.startsOn ? `از ${formatPersianDate(coupon.startsOn)}` : `تا ${formatPersianDate(coupon.endsOn!)}`
}

export function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponDto[]>([])
  const [form, setForm] = useState<Form>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const save = useAsyncAction()
  const rowAction = useAsyncAction()

  const load = useCallback(async () => {
    try { setCoupons(await adminApi.coupons()); setError(null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = (value: Partial<Form>) => setForm((current) => ({ ...current, ...value }))
  const percent = form.discountType === CouponDiscountType.Percent

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const request = couponRequest(form)
    if (typeof request === 'string') { setError(request); return }
    void save.run(async () => {
      try {
        if (form.id) await adminApi.updateCoupon(form.id, request)
        else await adminApi.createCoupon(request)
        setNotice(form.id ? 'کد تخفیف ویرایش شد.' : 'کد تخفیف ساخته شد.')
        setError(null)
        setForm(emptyForm())
        await load()
      } catch (reason) { setError(errorText(reason)) }
    })
  }

  const toggle = (coupon: CouponDto) => void rowAction.run(async () => {
    const request = couponRequest({ ...toForm(coupon), isActive: !coupon.isActive })
    if (typeof request === 'string') return setError(request)
    try { await adminApi.updateCoupon(coupon.id, request); await load() }
    catch (reason) { setError(errorText(reason)) }
  })

  const remove = (coupon: CouponDto) => {
    if (!window.confirm(`کد «${coupon.code}» حذف شود؟`)) return
    void rowAction.run(async () => {
      try { await adminApi.deleteCoupon(coupon.id); setNotice('کد تخفیف حذف شد.'); await load() }
      catch (reason) { setError(errorText(reason)) }
    })
  }

  return <PageFrame title="کدهای تخفیف"
    description="تخفیف فقط از مبلغ غذا کم می‌شود، نه از هزینه ارسال. سفارش لغوشده سهمیه کد را مصرف نمی‌کند.">
    <Message error={error} />
    {notice && <Message>{notice}</Message>}

    <section className="panel admin-controls">
      <form className="form-grid coupon-form" onSubmit={submit}>
        <label>کد<input dir="ltr" value={form.code} maxLength={40} placeholder="KAFGIR10"
          onChange={(event) => patch({ code: event.target.value.toUpperCase() })} /></label>
        <label>عنوان (اختیاری)<input value={form.title} maxLength={150} placeholder="تخفیف اولین سفارش"
          onChange={(event) => patch({ title: event.target.value })} /></label>
        <label>نوع تخفیف
          <select value={form.discountType} onChange={(event) => patch({ discountType: Number(event.target.value), value: '', maxDiscount: '' })}>
            <option value={CouponDiscountType.Percent}>درصدی</option>
            <option value={CouponDiscountType.Fixed}>مبلغ ثابت</option>
          </select>
        </label>
        {percent
          ? <label>درصد<input inputMode="decimal" value={form.value} placeholder="10"
              onChange={(event) => patch({ value: event.target.value })} /></label>
          : <AmountField label="مبلغ (تومان)" value={form.value} placeholder="50,000" onChange={(value) => patch({ value })} />}
        {percent && <AmountField label="سقف تخفیف (اختیاری)" value={form.maxDiscount} placeholder="100,000"
          onChange={(value) => patch({ maxDiscount: value })} />}
        <AmountField label="حداقل مبلغ غذا (اختیاری)" value={form.minOrder} placeholder="300,000"
          onChange={(value) => patch({ minOrder: value })} />
        <DateField label="از تاریخ" allowClear value={form.startsOn} onChange={(value) => patch({ startsOn: value })} />
        <DateField label="تا تاریخ" allowClear value={form.endsOn} onChange={(value) => patch({ endsOn: value })} />
        <label>سقف کل استفاده<input inputMode="numeric" value={form.usageLimit} placeholder="نامحدود"
          onChange={(event) => patch({ usageLimit: event.target.value })} /></label>
        <label>سقف برای هر مشتری<input inputMode="numeric" value={form.perCustomerLimit} placeholder="نامحدود"
          onChange={(event) => patch({ perCustomerLimit: event.target.value })} /></label>
        <div className="coupon-form-toggles">
          <label className="switch"><input type="checkbox" checked={form.firstOrderOnly}
            onChange={(event) => patch({ firstOrderOnly: event.target.checked })} />فقط اولین سفارش</label>
          <label className="switch"><input type="checkbox" checked={form.isActive}
            onChange={(event) => patch({ isActive: event.target.checked })} />فعال</label>
          <div className="coupon-form-actions">
            <button className="primary" disabled={save.busy}>{save.busy ? 'در حال ذخیره…' : form.id ? 'ذخیره تغییرات' : 'ساخت کد'}</button>
            {form.id && <button type="button" onClick={() => setForm(emptyForm())}>انصراف</button>}
          </div>
        </div>
      </form>
    </section>

    <section className="panel table-panel">
      <div className="table-panel-head"><h2>کدها</h2><span>{formatNumber(coupons.length)} کد</span></div>
      <ListState loading={loading} error={null} isEmpty={!loading && coupons.length === 0} emptyText="هنوز کد تخفیفی ساخته نشده است." />
      {coupons.length > 0 && <div className="table-wrap"><table className="coupon-table">
        <thead><tr><th>کد</th><th>تخفیف</th><th>اعتبار</th><th>محدودیت</th><th>استفاده و تخفیف داده‌شده</th><th>وضعیت</th><th /></tr></thead>
        <tbody>{coupons.map((coupon) => <tr key={coupon.id} className={coupon.id === form.id ? 'selected-row' : undefined}>
          <td className="text-cell"><strong dir="ltr">{coupon.code}</strong>{coupon.title && <small className="coupon-title">{coupon.title}</small>}</td>
          <td className="text-cell">{couponSummary(coupon)}</td>
          <td>{validityText(coupon)}</td>
          <td className="text-cell">{[
            coupon.usageLimit ? `کل ${formatNumber(coupon.usageLimit)}` : null,
            coupon.perCustomerLimit ? `هر مشتری ${formatNumber(coupon.perCustomerLimit)}` : null,
            coupon.firstOrderOnly ? 'فقط اولین سفارش' : null,
          ].filter(Boolean).join(' · ') || '—'}</td>
          <td>{formatNumber(coupon.timesUsed)}{coupon.usageLimit ? ` از ${formatNumber(coupon.usageLimit)}` : ''} بار
            {coupon.totalDiscount > 0 && <small className="coupon-title">{formatMoney(coupon.totalDiscount)}</small>}</td>
          <td><span className={`badge ${coupon.isActive ? 'open' : 'closed'}`}>{coupon.isActive ? 'فعال' : 'غیرفعال'}</span></td>
          <td><div className="action-row">
            <button type="button" onClick={() => { setForm(toForm(coupon)); setNotice(null) }}>ویرایش</button>
            <button type="button" disabled={rowAction.busy} onClick={() => toggle(coupon)}>{coupon.isActive ? 'غیرفعال کردن' : 'فعال کردن'}</button>
            {coupon.timesUsed === 0 && <button type="button" className="danger" disabled={rowAction.busy} onClick={() => remove(coupon)}>حذف</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </PageFrame>
}
