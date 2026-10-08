import { useEffect, useState, type FormEvent } from 'react'
import { BrandedState } from '../../design-system/BrandedState'
import { ButtonLoading } from '../../design-system/ButtonLoading'
import { Icon, type IconName } from '../../design-system/Icon'
import { OtpCodeInput } from '../../design-system/OtpCodeInput'
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
import { formatNumber, formatPersianDateTime } from '../../utils/format'
import { awaitsReview, CustomerOrderDetails, CustomerOrdersList, isActiveOrder, OrderReviewDialog, ReviewStars } from './CustomerOrders'

type LoginStep = 'phone' | 'code'
export type AccountSection = 'home' | 'orders' | 'reviews' | 'info' | 'addresses'
const emptyAddress: CustomerAddressWriteRequest = {
  title: '',
  city: 'اندیمشک',
  addressLine: '',
  isDefault: false,
}

export function ProfilePage({ onBack, onAuthenticationChange, onContact, initialSection = 'home' }: {
  onBack: () => void
  onAuthenticationChange: (authenticated: boolean) => void
  onContact?: () => void
  /** Where the account opens — the order-success page sends customers straight to their orders. */
  initialSection?: AccountSection
}) {
  const [section, setSection] = useState<AccountSection>(initialSection)
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
  const [isAddressSubmitting, setIsAddressSubmitting] = useState(false)
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [address, setAddress] = useState<CustomerAddressWriteRequest>(emptyAddress)
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  // The address form opens only on demand: from «آدرس جدید» or an address's «ویرایش».
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<{ id: number; orderNumber: string; review: OrderReviewDto | null } | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [openingOrderId, setOpeningOrderId] = useState<number | null>(null)
  const [nameSaved, setNameSaved] = useState(false)

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
    try {
      setProfile(await updateCustomerProfile(editingName))
      setNameSaved(true)
    }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'ویرایش نام ممکن نشد.') }
    finally { setIsSubmitting(false) }
  }

  const startAddressEdit = (item?: CustomerAddressDto) => {
    setIsAddressFormOpen(true)
    setEditingAddressId(item?.id ?? null)
    setAddress(item ? {
      title: item.title,
      city: item.city,
      addressLine: item.addressLine,
      isDefault: item.isDefault,
    } : emptyAddress)
  }

  const closeAddressForm = () => {
    setEditingAddressId(null)
    setAddress(emptyAddress)
    setIsAddressFormOpen(false)
  }

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault()
    setIsAddressSubmitting(true)
    setError(null)
    try {
      const updated = editingAddressId
        ? await updateCustomerAddress(editingAddressId, address)
        : await createCustomerAddress(address)
      setProfile(updated)
      closeAddressForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ذخیره آدرس ممکن نشد.')
    } finally {
      setIsAddressSubmitting(false)
    }
  }

  const removeAddress = async (id: number) => {
    if (!window.confirm('این آدرس حذف شود؟')) return
    setError(null)
    setDeletingAddressId(id)
    try { setProfile(await deleteCustomerAddress(id)) }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'حذف آدرس ممکن نشد.') }
    finally { setDeletingAddressId(null) }
  }

  const openOrder = async (id: number) => {
    if (openingOrderId != null) return
    setOpeningOrderId(id)
    setError(null)
    try { setSelectedOrder(await getCustomerOrder(id)) }
    catch (orderError) { setError(orderError instanceof Error ? orderError.message : 'دریافت سفارش ممکن نشد.') }
    finally { setOpeningOrderId(null) }
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
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      // The session ends locally whatever the server says: staying signed in after asking to leave is
      // the worse outcome, and the cookie is cleared by the same request.
      await logoutCustomer()
    } finally {
      setIsLoggingOut(false)
      setProfile(null)
      setOrders(null)
      setSelectedOrder(null)
      setSection('home')
      setPhone('')
      onAuthenticationChange(false)
    }
  }

  if (isLoading && !profile) return <BrandedState title="در حال دریافت حساب شما" message="کمی صبر کنید…" icon="profile" />

  if (!profile) return (
    <main className="account-login">
      <form className="account-login-card" onSubmit={loginStep === 'phone' ? sendOtp : verifyOtp}>
        <span className="account-login-icon" aria-hidden="true"><Icon name="profile" size="xl" /></span>
        <h1>{loginStep === 'phone' ? 'ورود به حساب کفگیر' : 'کد تایید را وارد کنید'}</h1>
        <p>
          {loginStep === 'phone'
            ? 'با شماره موبایل وارد شوید تا سفارش‌ها، آدرس‌ها و نظرهایتان همیشه در دسترس باشد.'
            : <>کد شش‌رقمی ارسال‌شده به <bdi dir="ltr">{phone}</bdi> را وارد کنید.</>}
        </p>
        {loginStep === 'phone'
          ? <label className="field">شماره موبایل<input className="ltr-value" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09121234567" /></label>
          : <OtpCodeInput value={code} onChange={setCode} autoFocus />}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button full-width" disabled={isSubmitting}>{isSubmitting ? 'لطفاً صبر کنید…' : loginStep === 'phone' ? 'ارسال کد تایید' : 'ورود'}</button>
        {loginStep === 'code' && <div className="otp-actions">
          <button type="button" className="outline-button" onClick={() => setLoginStep('phone')}>تغییر شماره</button>
          <button type="button" className="outline-button" disabled={resendSeconds > 0 || isSubmitting} onClick={() => void sendOtp()}>
            {resendSeconds > 0 ? `ارسال دوباره تا ${formatNumber(resendSeconds)} ثانیه` : 'ارسال دوباره'}
          </button>
        </div>}
        <button type="button" className="account-login-skip" onClick={onBack}>فعلاً منوی امروز را ببینم</button>
      </form>
    </main>
  )

  const orderItems = orders?.items ?? []
  const activeCount = orderItems.filter(isActiveOrder).length
  const pendingReviews = orderItems.filter(awaitsReview)
  const reviewedOrders = orderItems.filter((order) => order.review != null)
  const nextReview = pendingReviews[0]
  const displayName = profile.preferredName.trim() || 'مشتری کفگیر'
  const initial = [...displayName][0] ?? 'ک'
  const goTo = (next: AccountSection) => {
    setSection(next)
    setSelectedOrder(null)
    setError(null)
    if (next !== 'addresses') closeAddressForm()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const reviewDialog = reviewTarget && <OrderReviewDialog key={reviewTarget.id} orderNumber={reviewTarget.orderNumber}
    review={reviewTarget.review} busy={isReviewSubmitting} error={reviewError}
    onClose={() => setReviewTarget(null)} onSave={(rating, comment) => void submitReview(rating, comment)} />

  const navItems: Array<{ group: string; items: Array<{ key: AccountSection; icon: IconName; title: string; hint: string; badge?: number }> }> = [
    { group: 'سفارش‌ها', items: [
      { key: 'orders', icon: 'orders', title: 'سفارش‌های من', hint: activeCount > 0 ? `${formatNumber(activeCount)} سفارش در جریان` : 'پیگیری، جزئیات و فاکتور', badge: activeCount },
      { key: 'reviews', icon: 'rating', title: 'نظرسنجی و امتیازها', hint: pendingReviews.length > 0 ? `${formatNumber(pendingReviews.length)} سفارش منتظر نظر شما` : 'نظرهایی که ثبت کرده‌اید', badge: pendingReviews.length },
    ] },
    { group: 'حساب کاربری', items: [
      { key: 'info', icon: 'profile', title: 'اطلاعات شخصی', hint: profile.phoneNumberConfirmed ? 'نام و شماره موبایل' : 'شماره موبایل تایید نشده' },
      { key: 'addresses', icon: 'location', title: 'آدرس‌های من', hint: profile.addresses.length > 0 ? `${formatNumber(profile.addresses.length)} آدرس ذخیره‌شده` : 'هنوز آدرسی ثبت نشده' },
    ] },
  ]

  const sectionTitle: Record<Exclude<AccountSection, 'home'>, string> = {
    orders: 'سفارش‌های من', reviews: 'نظرسنجی و امتیازها', info: 'اطلاعات شخصی', addresses: 'آدرس‌های من',
  }
  // On a wide screen the menu stays beside the content, so "home" simply shows the orders.
  const content: Exclude<AccountSection, 'home'> = section === 'home' ? 'orders' : section

  return (
    <main className={`account-page ${section === 'home' ? 'is-home' : 'is-section'}`}>
      <aside className="account-sidebar">
        <section className="account-hero">
          <span className="account-avatar" aria-hidden="true">{initial}</span>
          <div className="account-hero-copy">
            <h1>{displayName}</h1>
            <p>
              <bdi dir="ltr">{profile.defaultPhoneNumber || 'شماره ثبت نشده'}</bdi>
              {profile.phoneNumberConfirmed && <span className="verified-label"><Icon name="confirm" size="xs" /> تاییدشده</span>}
            </p>
          </div>
          <div className="account-stats">
            <button type="button" onClick={() => goTo('orders')}><strong>{formatNumber(orders?.totalItems ?? 0)}</strong><span>سفارش</span></button>
            <button type="button" onClick={() => goTo('reviews')}><strong>{formatNumber(reviewedOrders.length)}</strong><span>نظر ثبت‌شده</span></button>
            <button type="button" onClick={() => goTo('addresses')}><strong>{formatNumber(profile.addresses.length)}</strong><span>آدرس</span></button>
          </div>
        </section>

        {nextReview && <button type="button" className="account-review-nudge" onClick={() => openReview(nextReview)}>
          <span className="account-review-nudge-icon" aria-hidden="true"><Icon name="rating" size="md" /></span>
          <span><strong>سفارش <bdi dir="ltr">#{nextReview.orderNumber}</bdi> چطور بود؟</strong><small>با یک امتیاز کوتاه کمکمان کنید</small></span>
          <Icon name="forward" size="sm" />
        </button>}

        <nav className="account-nav" aria-label="بخش‌های حساب">
          {navItems.map((group) => <div className="account-nav-group" key={group.group}>
            <h2>{group.group}</h2>
            <ul>{group.items.map((item) => <li key={item.key}>
              <button type="button" className={content === item.key ? 'active' : ''} aria-current={content === item.key && section !== 'home' ? 'page' : undefined} onClick={() => goTo(item.key)}>
                <span className="account-nav-icon" aria-hidden="true"><Icon name={item.icon} size="md" /></span>
                <span className="account-nav-copy"><strong>{item.title}</strong><small>{item.hint}</small></span>
                {item.badge ? <span className="account-nav-badge">{formatNumber(item.badge)}</span> : null}
                <Icon name="forward" size="sm" className="account-nav-chevron" />
              </button>
            </li>)}</ul>
          </div>)}
          <div className="account-nav-group">
            <h2>پشتیبانی</h2>
            <ul>
              {onContact && <li><button type="button" onClick={onContact}>
                <span className="account-nav-icon" aria-hidden="true"><Icon name="support" size="md" /></span>
                <span className="account-nav-copy"><strong>تماس با کفگیر</strong><small>سوال، پیشنهاد یا مشکل سفارش</small></span>
                <Icon name="forward" size="sm" className="account-nav-chevron" />
              </button></li>}
              <li><button type="button" className="is-danger" disabled={isLoggingOut} onClick={() => void logout()}>
                <span className="account-nav-icon" aria-hidden="true"><Icon name="logout" size="md" /></span>
                <span className="account-nav-copy"><strong>{isLoggingOut ? <ButtonLoading label="در حال خروج…" /> : 'خروج از حساب'}</strong></span>
              </button></li>
            </ul>
          </div>
        </nav>
      </aside>

      <section className="account-content" aria-labelledby="account-section-title">
        {!selectedOrder && <header className="account-section-head">
          <button type="button" className="account-back" onClick={() => goTo('home')}><Icon name="back" size="sm" /> حساب من</button>
          <h2 id="account-section-title">{sectionTitle[content]}</h2>
          {content === 'orders' && orders && <span className="account-section-count">{formatNumber(orders.totalItems)} سفارش</span>}
          {content === 'addresses' && !isAddressFormOpen && <button type="button" className="outline-button account-section-action" onClick={() => startAddressEdit()}><Icon name="add" size="sm" /> آدرس جدید</button>}
        </header>}
        {error && content !== 'orders' && <div className="form-error" role="alert">{error}</div>}

        {content === 'orders' && (selectedOrder
          ? <CustomerOrderDetails order={selectedOrder} onBack={() => setSelectedOrder(null)} onReview={() => openReview(selectedOrder)} />
          : <CustomerOrdersList orders={orders} error={error} openingOrderId={openingOrderId} onRetry={() => void loadAccount()}
              onOpen={(id) => void openOrder(id)} onReview={openReview} onBrowse={onBack}
              onPage={(page) => void getCustomerOrders(page).then(setOrders).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'دریافت سفارش‌ها ممکن نشد.'))} />)}

        {content === 'reviews' && <div className="account-reviews">
          {pendingReviews.length === 0 && reviewedOrders.length === 0 && <div className="account-empty">
            <span className="account-empty-icon"><Icon name="rating" size="xl" /></span>
            <h3>هنوز سفارش تحویل‌شده‌ای ندارید.</h3>
            <p>بعد از تحویل هر سفارش می‌توانید اینجا به آن امتیاز بدهید.</p>
          </div>}
          {pendingReviews.length > 0 && <section className="order-group">
            <h3 className="order-group-title">منتظر نظر شما</h3>
            {pendingReviews.map((order) => <article className="account-card review-row is-pending" key={order.id}>
              <div className="review-row-copy">
                <strong dir="ltr">#{order.orderNumber}</strong>
                <span>{order.foodSummary}</span>
                <time>{formatPersianDateTime(order.createdAt)}</time>
              </div>
              <button type="button" className="review-row-stars" onClick={() => openReview(order)} aria-label={`امتیاز به سفارش ${order.orderNumber}`}>
                <ReviewStars value={0} size="md" />
                <span>امتیاز بدهید</span>
              </button>
            </article>)}
          </section>}
          {reviewedOrders.length > 0 && <section className="order-group">
            <h3 className="order-group-title">نظرهای ثبت‌شده</h3>
            {reviewedOrders.map((order) => <article className="account-card review-row" key={order.id}>
              <div className="review-row-copy">
                <strong dir="ltr">#{order.orderNumber}</strong>
                <span>{order.foodSummary}</span>
                <ReviewStars value={order.review?.rating ?? 0} size="sm" />
                {order.review?.comment && <p>«{order.review.comment}»</p>}
              </div>
              <button type="button" className="outline-button" onClick={() => openReview(order)}><Icon name="edit" size="xs" /> ویرایش</button>
            </article>)}
          </section>}
          {orders && orders.totalPages > 1 && <p className="account-note">این فهرست از سفارش‌های صفحه فعلی «سفارش‌های من» ساخته می‌شود.</p>}
        </div>}

        {content === 'info' && <div className="account-info">
          <form className="account-card form-grid" onSubmit={saveName}>
            <h3 className="account-card-title"><Icon name="profile" size="sm" /> نام شما</h3>
            <label className="field">نام و نام خانوادگی<input value={editingName} onChange={(event) => { setEditingName(event.target.value); setNameSaved(false) }} /></label>
            <div className="account-form-foot">
              {nameSaved && <span className="account-saved" role="status"><Icon name="confirm" size="xs" /> ذخیره شد</span>}
              <button className="primary-button" disabled={isSubmitting || editingName.trim() === profile.preferredName}>ذخیره نام</button>
            </div>
          </form>
          <section className="account-card">
            <h3 className="account-card-title"><Icon name="phone" size="sm" /> راه‌های ورود</h3>
            <dl className="account-identity">
              <div><dt>شماره موبایل</dt><dd><bdi dir="ltr">{profile.defaultPhoneNumber || 'ثبت نشده'}</bdi>{profile.phoneNumberConfirmed ? <span className="verified-label"><Icon name="confirm" size="xs" /> تاییدشده</span> : <span className="unverified-label">تایید نشده</span>}</dd></div>
              {profile.telegramUserId != null && <div><dt>حساب تلگرام</dt><dd><bdi dir="ltr">{profile.telegramUsername ? `@${profile.telegramUsername}` : `شناسه ${profile.telegramUserId}`}</bdi><span className="verified-label"><Icon name="confirm" size="xs" /> متصل</span></dd></div>}
            </dl>
          </section>
          {!profile.phoneNumberConfirmed && <form className="account-card form-grid account-verify" onSubmit={loginStep === 'phone' ? sendOtp : verifyOtp}>
            <h3 className="account-card-title"><Icon name="info" size="sm" /> تایید شماره موبایل</h3>
            <p className="muted">با تایید شماره، سفارش‌ها و آدرس‌های ثبت‌شده با این موبایل به همین حساب متصل می‌شوند. فقط داشتن یا وارد کردن شماره برای دسترسی کافی نیست.</p>
            {loginStep === 'phone'
              ? <label className="field">شماره موبایل<input className="ltr-value" dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              : <OtpCodeInput value={code} onChange={setCode} autoFocus />}
            <button className="primary-button" disabled={isSubmitting}>{loginStep === 'phone' ? 'ارسال کد' : 'تایید شماره'}</button>
          </form>}
        </div>}

        {content === 'addresses' && <div className="account-addresses">
          {isAddressFormOpen && <form className="account-card form-grid address-form-card" onSubmit={saveAddress}>
            <h3 className="account-card-title"><Icon name={editingAddressId ? 'edit' : 'add'} size="sm" /> {editingAddressId ? 'ویرایش آدرس' : 'آدرس جدید'}</h3>
            <div className="form-grid two-columns">
              <label className="field">عنوان<input value={address.title} onChange={(event) => setAddress({ ...address, title: event.target.value })} placeholder="خانه یا محل کار" /></label>
              <label className="field">شهر<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
            </div>
            <label className="field">نشانی<textarea value={address.addressLine} onChange={(event) => setAddress({ ...address, addressLine: event.target.value })} placeholder="خیابان، کوچه، پلاک، واحد" /></label>
            <label className="check-field"><input type="checkbox" checked={address.isDefault} onChange={(event) => setAddress({ ...address, isDefault: event.target.checked })} /> آدرس پیش‌فرض</label>
            <div className="form-actions"><button className="primary-button" disabled={isAddressSubmitting || deletingAddressId !== null}>{isAddressSubmitting ? <ButtonLoading label={editingAddressId ? 'در حال به‌روزرسانی آدرس…' : 'در حال ثبت آدرس…'} /> : editingAddressId ? 'به‌روزرسانی آدرس' : 'ثبت آدرس'}</button><button type="button" className="outline-button" disabled={isAddressSubmitting} onClick={closeAddressForm}>انصراف</button></div>
          </form>}
          {profile.addresses.length === 0 && !isAddressFormOpen && <div className="account-empty">
            <span className="account-empty-icon"><Icon name="location" size="xl" /></span>
            <h3>هنوز آدرسی ذخیره نکرده‌اید.</h3>
            <p>آدرس‌ها را یک بار ثبت کنید تا موقع سفارش فقط انتخابشان کنید.</p>
            <button type="button" className="primary-button" onClick={() => startAddressEdit()}><Icon name="add" size="sm" /> افزودن آدرس</button>
          </div>}
          <div className="address-list">
            {profile.addresses.map((item) => <article className={`account-card customer-address-card${item.isDefault ? ' is-default' : ''}`} key={item.id}>
              <span className="address-card-icon" aria-hidden="true"><Icon name={/کار|شرکت|اداره/u.test(item.title) ? 'kitchen' : 'home'} size="md" /></span>
              <div className="address-card-copy">
                <strong>{item.title}{item.isDefault && <span className="address-default">پیش‌فرض</span>}</strong>
                <p>{item.city}، {item.addressLine}</p>
              </div>
              <div className="address-card-actions">
                <button type="button" className="icon-action" aria-label={`ویرایش ${item.title}`} disabled={isAddressSubmitting || deletingAddressId !== null} onClick={() => { startAddressEdit(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Icon name="edit" size="sm" /></button>
                <button type="button" className="icon-action is-danger" aria-label={`حذف ${item.title}`} disabled={isAddressSubmitting || deletingAddressId !== null} onClick={() => void removeAddress(item.id)}>{deletingAddressId === item.id ? <span className="menu-load-spinner" aria-hidden="true" /> : <Icon name="delete" size="sm" />}</button>
              </div>
            </article>)}
          </div>
        </div>}
      </section>
      {reviewDialog}
    </main>
  )
}
