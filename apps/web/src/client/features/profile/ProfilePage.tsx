import { useEffect, useState, type FormEvent } from 'react'
import { BrandedState } from '../../design-system/BrandedState'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerOrder,
  getCustomerOrders,
  getCustomerSession,
  loginCustomerWithTelegram,
  logoutCustomer,
  requestCustomerOtp,
  updateCustomerAddress,
  updateCustomerProfile,
  verifyCustomerOtp,
} from '../../services/customerApi'
import { getTelegramInitData } from '../../services/telegram'
import {
  DeliveryMethod,
  type CustomerAddressDto,
  type CustomerAddressWriteRequest,
  type CustomerOrdersPageDto,
  type CustomerProfileDto,
  type OrderDto,
} from '../../types'
import { formatMoney, formatNumber, formatPersianDateTime } from '../../utils/format'
import { OrderInvoice } from '../orders/OrderInvoice'

type LoginStep = 'phone' | 'code'
const emptyAddress: CustomerAddressWriteRequest = {
  title: '',
  city: 'اندیمشک',
  addressLine: '',
  isDefault: false,
}
const asciiDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/\D/g, '')

export function ProfilePage({ onBack, onAuthenticationChange }: {
  onBack: () => void
  onAuthenticationChange: (authenticated: boolean) => void
}) {
  const [profile, setProfile] = useState<CustomerProfileDto | null>(null)
  const [orders, setOrders] = useState<CustomerOrdersPageDto | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loginStep, setLoginStep] = useState<LoginStep>('phone')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [address, setAddress] = useState<CustomerAddressWriteRequest>(emptyAddress)
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)

  const loadAccount = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let session = await getCustomerSession()
      const initData = getTelegramInitData()
      if (!session.authenticated && initData) session = await loginCustomerWithTelegram(initData)
      if (session.authenticated && session.profile) {
        onAuthenticationChange(true)
        setProfile(session.profile)
        setEditingName(session.profile.preferredName)
        setOrders(await getCustomerOrders())
      } else onAuthenticationChange(false)
    } catch (loadError) {
      onAuthenticationChange(false)
      setError(loadError instanceof Error ? loadError.message : 'دریافت حساب کاربری ممکن نشد.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadAccount() }, [])
  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await requestCustomerOtp(phone)
      setLoginStep('code')
      setResendSeconds(60)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال کد تایید ممکن نشد.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const session = await verifyCustomerOtp(phone, code)
      if (!session.profile) throw new Error('پروفایل مشتری ایجاد نشد.')
      setProfile(session.profile)
      onAuthenticationChange(true)
      setEditingName(session.profile.preferredName)
      setOrders(await getCustomerOrders())
      setCode('')
      setLoginStep('phone')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'کد تایید پذیرفته نشد.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try { setProfile(await updateCustomerProfile(editingName)) }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'ویرایش نام ممکن نشد.') }
    finally { setIsSubmitting(false) }
  }

  const startAddressEdit = (item?: CustomerAddressDto) => {
    setEditingAddressId(item?.id ?? null)
    setAddress(item ? {
      title: item.title,
      city: item.city,
      addressLine: item.addressLine,
      isDefault: item.isDefault,
    } : emptyAddress)
  }

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const updated = editingAddressId
        ? await updateCustomerAddress(editingAddressId, address)
        : await createCustomerAddress(address)
      setProfile(updated)
      startAddressEdit()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ذخیره آدرس ممکن نشد.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeAddress = async (id: number) => {
    if (!window.confirm('این آدرس حذف شود؟')) return
    setError(null)
    try { setProfile(await deleteCustomerAddress(id)) }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'حذف آدرس ممکن نشد.') }
  }

  const openOrder = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try { setSelectedOrder(await getCustomerOrder(id)) }
    catch (orderError) { setError(orderError instanceof Error ? orderError.message : 'دریافت سفارش ممکن نشد.') }
    finally { setIsLoading(false) }
  }

  const logout = async () => {
    await logoutCustomer()
    setProfile(null)
    setOrders(null)
    setSelectedOrder(null)
    setPhone('')
    onAuthenticationChange(false)
  }

  if (isLoading && !profile) return <BrandedState title="در حال دریافت حساب شما" message="کمی صبر کنید…" icon="profile" />

  if (!profile) return (
    <main className="profile-login-page">
      <div className="page-actions">
        <div><p className="eyebrow"><Icon name="profile" size="sm" /> حساب مشتری</p><h1 className="section-title">پروفایل کفگیر</h1></div>
        <button className="checkout-back-link" onClick={onBack}>بازگشت <Icon name="back" size="sm" /></button>
      </div>
      <form className="panel form-grid profile-login-card" onSubmit={loginStep === 'phone' ? sendOtp : verifyOtp}>
        <h2 className="section-title">{loginStep === 'phone' ? 'ورود با شماره موبایل' : 'کد تایید'}</h2>
        <p className="muted">
          {loginStep === 'phone'
            ? 'برای مشاهده سفارش‌ها و آدرس‌های خود شماره موبایل را وارد کنید.'
            : `کد شش‌رقمی ارسال‌شده به ${phone} را وارد کنید.`}
        </p>
        {loginStep === 'phone'
          ? <label className="field">شماره موبایل<input className="ltr-value" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09121234567" /></label>
          : <label className="field">کد تایید<input className="otp-input ltr-value" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(asciiDigits(event.target.value))} /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button full-width" disabled={isSubmitting}>{isSubmitting ? 'لطفاً صبر کنید…' : loginStep === 'phone' ? 'ارسال کد تایید' : 'مشاهده پروفایل'}</button>
        {loginStep === 'code' && <div className="otp-actions">
          <button type="button" className="outline-button" onClick={() => setLoginStep('phone')}>تغییر شماره</button>
          <button type="button" className="outline-button" disabled={resendSeconds > 0 || isSubmitting} onClick={() => void sendOtp()}>
            {resendSeconds > 0 ? `ارسال دوباره تا ${formatNumber(resendSeconds)} ثانیه` : 'ارسال دوباره'}
          </button>
        </div>}
      </form>
    </main>
  )

  if (selectedOrder) return (
    <main className="customer-order-detail">
      <div className="page-actions">
        <div><p className="eyebrow">شماره سفارش {formatNumber(selectedOrder.orderNumber)}</p><h1 className="section-title">جزئیات سفارش</h1></div>
        <button className="checkout-back-link" onClick={() => setSelectedOrder(null)}>سفارش‌ها <Icon name="back" size="sm" /></button>
      </div>
      <section className="panel order-detail-summary">
        <div><span>وضعیت</span><StatusBadge status={selectedOrder.status} /></div>
        <div><span>زمان ثبت</span><strong>{formatPersianDateTime(selectedOrder.createdAt)}</strong></div>
        <div><span>روش دریافت</span><strong>{selectedOrder.deliveryMethod === DeliveryMethod.Delivery ? 'ارسال' : 'تحویل حضوری'}</strong></div>
        <div><span>مبلغ کل</span><strong className="price">{formatMoney(selectedOrder.totalAmount)}</strong></div>
      </section>
      <section className="panel">
        <h2 className="section-title">اقلام سفارش</h2>
        {selectedOrder.items.map((item) => <div className="customer-order-line" key={item.id}>
          <strong>{item.foodName}</strong><span>{formatNumber(item.quantity)} پرس</span><span>{formatMoney(item.totalPrice)}</span>
        </div>)}
      </section>
      <section className="panel">
        <h2 className="section-title">تحویل سفارش</h2>
        <p>{selectedOrder.customerFullName}، <bdi>{selectedOrder.customerPhoneNumber}</bdi></p>
        {selectedOrder.addressLine && <p>{selectedOrder.addressLine}</p>}
      </section>
      <OrderInvoice order={selectedOrder} />
      <section className="panel">
        <h2 className="section-title">تاریخچه وضعیت</h2>
        <ol className="order-timeline">
          {selectedOrder.statusHistories.map((item, index) => <li key={`${item.changedAt}-${index}`}>
            <StatusBadge status={item.toStatus} /><time>{formatPersianDateTime(item.changedAt)}</time>{item.note && <small>{item.note}</small>}
          </li>)}
        </ol>
      </section>
    </main>
  )

  return (
    <main className="customer-profile-page">
      <div className="page-actions">
        <div><p className="eyebrow"><Icon name="profile" size="sm" /> حساب مشتری</p><h1 className="section-title">پروفایل من</h1></div>
        <button className="checkout-back-link" onClick={onBack}>منوی امروز <Icon name="back" size="sm" /></button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="profile-layout">
        <div>
          <form className="panel form-grid" onSubmit={saveName}>
            <h2 className="section-title">اطلاعات حساب</h2>
            <label className="field">نام و نام خانوادگی<input value={editingName} onChange={(event) => setEditingName(event.target.value)} /></label>
            <div className="profile-identity"><span>شماره موبایل</span><bdi>{profile.defaultPhoneNumber || 'ثبت نشده'}</bdi>{profile.phoneNumberConfirmed && <span className="verified-label"><Icon name="confirm" size="xs" /> تاییدشده</span>}</div>
            {profile.telegramUserId != null && <div className="profile-identity profile-telegram-identity">
              <span>حساب تلگرام</span>
              <bdi>{profile.telegramUsername ? `@${profile.telegramUsername}` : 'بدون نام کاربری'}</bdi>
              <small>شناسه: <bdi>{profile.telegramUserId}</bdi></small>
              <span className="verified-label"><Icon name="confirm" size="xs" /> متصل</span>
            </div>}
            <button className="primary-button" disabled={isSubmitting}>ذخیره نام</button>
          </form>

          {!profile.phoneNumberConfirmed && <form className="panel form-grid" onSubmit={loginStep === 'phone' ? sendOtp : verifyOtp}>
            <h2 className="section-title">تایید شماره موبایل</h2>
            <p className="muted">با تایید شماره، سفارش‌ها و آدرس‌های ثبت‌شده با این موبایل به همین حساب متصل می‌شوند. فقط داشتن یا وارد کردن شماره برای دسترسی کافی نیست.</p>
            {loginStep === 'phone'
              ? <label className="field">شماره موبایل<input className="ltr-value" dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              : <label className="field">کد تایید<input className="otp-input ltr-value" dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(asciiDigits(event.target.value))} /></label>}
            <button className="primary-button" disabled={isSubmitting}>{loginStep === 'phone' ? 'ارسال کد' : 'تایید شماره'}</button>
          </form>}

          <section className="panel">
            <div className="section-heading-row"><h2 className="section-title">آدرس‌های من</h2><button className="outline-button" onClick={() => startAddressEdit()}><Icon name="add" size="sm" /> آدرس جدید</button></div>
            <div className="address-list">
              {profile.addresses.length === 0 && <p className="muted">هنوز آدرسی ذخیره نشده است.</p>}
              {profile.addresses.map((item) => <article className="customer-address-card" key={item.id}>
                <div><strong>{item.title}</strong>{item.isDefault && <span>پیش‌فرض</span>}</div>
                <p>{item.city}، {item.addressLine}</p>
                <div><button className="outline-button" onClick={() => startAddressEdit(item)}><Icon name="edit" size="xs" /> ویرایش</button><button className="outline-button danger-outline" onClick={() => void removeAddress(item.id)}><Icon name="delete" size="xs" /> حذف</button></div>
              </article>)}
            </div>
          </section>

          <form className="panel form-grid" onSubmit={saveAddress}>
            <h2 className="section-title">{editingAddressId ? 'ویرایش آدرس' : 'افزودن آدرس'}</h2>
            <div className="form-grid two-columns">
              <label className="field">عنوان<input value={address.title} onChange={(event) => setAddress({ ...address, title: event.target.value })} placeholder="خانه یا محل کار" /></label>
              <label className="field">شهر<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
            </div>
            <label className="field">نشانی<textarea value={address.addressLine} onChange={(event) => setAddress({ ...address, addressLine: event.target.value })} /></label>
            <label className="check-field"><input type="checkbox" checked={address.isDefault} onChange={(event) => setAddress({ ...address, isDefault: event.target.checked })} /> آدرس پیش‌فرض</label>
            <div className="form-actions"><button className="primary-button" disabled={isSubmitting}>ذخیره آدرس</button>{editingAddressId && <button type="button" className="outline-button" onClick={() => startAddressEdit()}>انصراف</button>}</div>
          </form>
          <button className="outline-button danger-outline profile-logout" onClick={() => void logout()}><Icon name="logout" size="sm" /> خروج از حساب</button>
        </div>

        <section className="panel customer-orders-panel">
          <h2 className="section-title">سفارش‌های من</h2>
          {!orders?.items.length && <p className="muted">هنوز سفارشی برای این حساب ثبت نشده است.</p>}
          <div className="customer-order-list">
            {orders?.items.map((item) => <button className="customer-order-card" key={item.id} onClick={() => void openOrder(item.id)}>
              <div><strong>سفارش {formatNumber(item.orderNumber)}</strong><StatusBadge status={item.status} /></div>
              <p>{item.foodSummary}</p>
              <div><span>{formatPersianDateTime(item.createdAt)}</span><strong>{formatMoney(item.totalAmount)}</strong></div>
            </button>)}
          </div>
          {orders && orders.totalPages > 1 && <div className="pagination-actions">
            <button className="outline-button" disabled={orders.page <= 1} onClick={async () => setOrders(await getCustomerOrders(orders.page - 1))}>قبلی</button>
            <span>صفحه {formatNumber(orders.page)} از {formatNumber(orders.totalPages)}</span>
            <button className="outline-button" disabled={orders.page >= orders.totalPages} onClick={async () => setOrders(await getCustomerOrders(orders.page + 1))}>بعدی</button>
          </div>}
        </section>
      </div>
    </main>
  )
}
