import { useEffect, useState, type FormEvent } from 'react'
import { BrandedState } from '../../design-system/BrandedState'
import { Icon } from '../../design-system/Icon'
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerOrder,
  getCustomerOrders,
  getCustomerSession,
  loginCustomerWithTelegram,
  logoutCustomer,
  requestCustomerOtp,
  saveCustomerOrderReview,
  updateCustomerAddress,
  updateCustomerProfile,
  verifyCustomerOtp,
} from '../../services/customerApi'
import { getTelegramInitData } from '../../services/telegram'
import type {
  CustomerAddressDto,
  CustomerAddressWriteRequest,
  CustomerOrderDetailDto,
  CustomerOrderSummaryDto,
  CustomerOrdersPageDto,
  CustomerProfileDto,
  OrderReviewDto,
} from '../../types'
import { formatNumber } from '../../utils/format'
import { CustomerOrderDetails, CustomerOrdersList, OrderReviewDialog } from './CustomerOrders'

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
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetailDto | null>(null)
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
  const [reviewTarget, setReviewTarget] = useState<{ id: number; orderNumber: string; review: OrderReviewDto | null } | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false)

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
      setResendSeconds(120)
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

  const openReview = (order: CustomerOrderSummaryDto | CustomerOrderDetailDto) => {
    setReviewError(null)
    setReviewTarget({ id: order.id, orderNumber: order.orderNumber, review: order.review })
  }

  const submitReview = async (rating: number, comment: string) => {
    if (!reviewTarget) return
    setIsReviewSubmitting(true)
    setReviewError(null)
    try {
      const review = await saveCustomerOrderReview(reviewTarget.id, { rating, comment: comment.trim() || null })
      setOrders((current) => current ? {
        ...current,
        items: current.items.map((item) => item.id === reviewTarget.id ? { ...item, review } : item),
      } : current)
      setSelectedOrder((current) => current?.id === reviewTarget.id ? { ...current, review } : current)
      setReviewTarget(null)
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : 'ثبت امتیاز و نظر ممکن نشد.')
    } finally {
      setIsReviewSubmitting(false)
    }
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

  if (selectedOrder) return <>
    <CustomerOrderDetails order={selectedOrder} onBack={() => setSelectedOrder(null)} onReview={() => openReview(selectedOrder)} />
    {reviewTarget && <OrderReviewDialog key={reviewTarget.id} orderNumber={reviewTarget.orderNumber} review={reviewTarget.review} busy={isReviewSubmitting} error={reviewError} onClose={() => setReviewTarget(null)} onSave={(rating, comment) => void submitReview(rating, comment)} />}
  </>

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

        <section className="panel customer-orders-panel" aria-labelledby="my-orders-title">
          <div className="orders-section-heading"><div><p className="eyebrow"><Icon name="orders" size="sm" /> سابقه خرید</p><h2 id="my-orders-title" className="section-title">سفارش‌های من</h2></div>{orders && <span>{formatNumber(orders.totalItems)} سفارش</span>}</div>
          <CustomerOrdersList orders={orders} error={error} onRetry={() => void loadAccount()} onOpen={(id) => void openOrder(id)} onReview={openReview} onBrowse={onBack} onPage={(page) => void getCustomerOrders(page).then(setOrders).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'دریافت سفارش‌ها ممکن نشد.'))} />
        </section>
      </div>
      {reviewTarget && <OrderReviewDialog key={reviewTarget.id} orderNumber={reviewTarget.orderNumber} review={reviewTarget.review} busy={isReviewSubmitting} error={reviewError} onClose={() => setReviewTarget(null)} onSave={(rating, comment) => void submitReview(rating, comment)} />}
    </main>
  )
}
