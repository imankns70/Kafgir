import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type {
  DeliveryMethodSettingDto,
  FoodTagGroupDto,
  FoodTagGroupWriteRequest,
  PaymentMethodSettingDto,
  SupportSubjectDto,
  SupportSubjectWriteRequest,
} from '@kafgir/contracts'
import { adminApi } from './api'

const emptyGroup: FoodTagGroupWriteRequest = {
  code: '', title: '', displayOrder: 0, isActive: true,
}
const emptySubject: SupportSubjectWriteRequest = { title: '', displayOrder: 0, isActive: true }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export function ReferenceDataPage() {
  const [groups, setGroups] = useState<FoodTagGroupDto[]>([])
  const [subjects, setSubjects] = useState<SupportSubjectDto[]>([])
  const [payments, setPayments] = useState<PaymentMethodSettingDto[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryMethodSettingDto[]>([])
  const [groupForm, setGroupForm] = useState(emptyGroup)
  const [groupCode, setGroupCode] = useState<string | null>(null)
  const [subjectForm, setSubjectForm] = useState(emptySubject)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const data = await adminApi.referenceData()
    setGroups(data.foodTagGroups); setSubjects(data.supportSubjects)
    setPayments(data.paymentMethods); setDeliveries(data.deliveryMethods)
  }, [])
  useEffect(() => { void load().catch((reason) => setError(errorText(reason))) }, [load])

  const saveGroup = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try {
      if (groupCode) await adminApi.updateFoodTagGroup(groupCode, groupForm)
      else await adminApi.createFoodTagGroup(groupForm)
      setGroupCode(null); setGroupForm(emptyGroup); await load()
    } catch (reason) { setError(errorText(reason)) }
  }
  const saveSubject = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try {
      if (subjectId) await adminApi.updateSupportSubject(subjectId, subjectForm)
      else await adminApi.createSupportSubject(subjectForm)
      setSubjectId(null); setSubjectForm(emptySubject); await load()
    } catch (reason) { setError(errorText(reason)) }
  }
  const savePayment = async (item: PaymentMethodSettingDto) => {
    setError('')
    try {
      await adminApi.updatePaymentMethod(item.method, {
        title: item.title, description: item.description,
        isCustomerEnabled: item.isCustomerEnabled, isManualEnabled: item.isManualEnabled,
        displayOrder: item.displayOrder,
      })
      await load()
    } catch (reason) { setError(errorText(reason)) }
  }
  const saveDelivery = async (item: DeliveryMethodSettingDto) => {
    setError('')
    try {
      await adminApi.updateDeliveryMethod(item.method, {
        title: item.title, description: item.description,
        isCustomerEnabled: item.isCustomerEnabled, isManualEnabled: item.isManualEnabled,
        displayOrder: item.displayOrder, deliveryFee: item.deliveryFee,
        minimumOrderAmount: item.minimumOrderAmount,
      })
      await load()
    } catch (reason) { setError(errorText(reason)) }
  }

  return <section className="page reference-data-page">
    <header className="page-header"><div><h1>اطلاعات پایه</h1><p>عنوان‌ها و دسترسی‌های عملیاتی را بدون تغییر کدهای سیستمی مدیریت کنید.</p></div></header>
    {error && <p className="message error" role="alert">{error}</p>}

    <section className="panel">
      <h2>گروه‌های برچسب غذا</h2>
      <form className="form-grid catalog-form" onSubmit={saveGroup}>
        <label>عنوان<input required value={groupForm.title} onChange={(event) => setGroupForm({ ...groupForm, title: event.target.value })} /></label>
        <label>کد انگلیسی<input required dir="ltr" disabled={Boolean(groupCode && groups.find((item) => item.code === groupCode)?.isSystem)} value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value.toLowerCase() })} /></label>
        <label>ترتیب<input type="number" min="0" value={groupForm.displayOrder} onChange={(event) => setGroupForm({ ...groupForm, displayOrder: Number(event.target.value) })} /></label>
        <label className="switch"><input type="checkbox" checked={groupForm.isActive} onChange={(event) => setGroupForm({ ...groupForm, isActive: event.target.checked })} />فعال</label>
        <button className="primary">{groupCode ? 'ذخیره گروه' : 'افزودن گروه'}</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>عنوان</th><th>کد</th><th>ترتیب</th><th>نوع</th><th>وضعیت</th><th /></tr></thead><tbody>
        {groups.map((item) => <tr key={item.code}><td>{item.title}</td><td dir="ltr">{item.code}</td><td>{item.displayOrder}</td><td>{item.isSystem ? 'سیستمی' : 'سفارشی'}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td><td><button type="button" onClick={() => { setGroupCode(item.code); setGroupForm({ code: item.code, title: item.title, displayOrder: item.displayOrder, isActive: item.isActive }) }}>ویرایش</button></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="panel">
      <h2>موضوعات پشتیبانی</h2>
      <form className="form-grid catalog-form" onSubmit={saveSubject}>
        <label>عنوان<input required value={subjectForm.title} onChange={(event) => setSubjectForm({ ...subjectForm, title: event.target.value })} /></label>
        <label>ترتیب<input type="number" min="0" value={subjectForm.displayOrder} onChange={(event) => setSubjectForm({ ...subjectForm, displayOrder: Number(event.target.value) })} /></label>
        <label className="switch"><input type="checkbox" checked={subjectForm.isActive} onChange={(event) => setSubjectForm({ ...subjectForm, isActive: event.target.checked })} />فعال برای پیام جدید</label>
        <button className="primary">{subjectId ? 'ذخیره موضوع' : 'افزودن موضوع'}</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>عنوان</th><th>ترتیب</th><th>نوع</th><th>وضعیت</th><th /></tr></thead><tbody>
        {subjects.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.displayOrder}</td><td>{item.isSystem ? 'سیستمی' : 'سفارشی'}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td><td><button type="button" onClick={() => { setSubjectId(item.id); setSubjectForm({ title: item.title, displayOrder: item.displayOrder, isActive: item.isActive }) }}>ویرایش</button></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="panel">
      <h2>روش‌های پرداخت</h2>
      <div className="reference-method-grid">{payments.map((item, index) => <article className="reference-method-card" key={item.method}>
        <label>عنوان<input value={item.title} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
        <label>توضیح<input value={item.description ?? ''} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value || null } : row))} /></label>
        <label>ترتیب<input type="number" min="0" value={item.displayOrder} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, displayOrder: Number(event.target.value) } : row))} /></label>
        <label className="switch"><input type="checkbox" checked={item.isCustomerEnabled} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, isCustomerEnabled: event.target.checked } : row))} />وب مشتری</label>
        <label className="switch"><input type="checkbox" checked={item.isManualEnabled} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, isManualEnabled: event.target.checked } : row))} />سفارش دستی</label>
        <button type="button" className="primary" onClick={() => void savePayment(item)}>ذخیره</button>
      </article>)}</div>
    </section>

    <section className="panel">
      <h2>روش‌های دریافت</h2>
      <div className="reference-method-grid">{deliveries.map((item, index) => <article className="reference-method-card" key={item.method}>
        <label>عنوان<input value={item.title} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
        <label>توضیح<input value={item.description ?? ''} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value || null } : row))} /></label>
        <label>هزینه ارسال<input inputMode="numeric" value={item.deliveryFee} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, deliveryFee: Number(event.target.value) } : row))} /></label>
        <label>حداقل سفارش<input inputMode="numeric" value={item.minimumOrderAmount} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, minimumOrderAmount: Number(event.target.value) } : row))} /></label>
        <label>ترتیب<input type="number" min="0" value={item.displayOrder} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, displayOrder: Number(event.target.value) } : row))} /></label>
        <label className="switch"><input type="checkbox" checked={item.isCustomerEnabled} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, isCustomerEnabled: event.target.checked } : row))} />وب مشتری</label>
        <label className="switch"><input type="checkbox" checked={item.isManualEnabled} onChange={(event) => setDeliveries((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, isManualEnabled: event.target.checked } : row))} />سفارش دستی</label>
        <button type="button" className="primary" onClick={() => void saveDelivery(item)}>ذخیره</button>
      </article>)}</div>
    </section>
  </section>
}
