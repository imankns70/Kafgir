import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getCustomerSession,
  loginCustomerWithTelegram,
  requestCustomerOtp,
  verifyCustomerOtp,
} from '../../services/customerApi'
import { createOrder, getOrderOptions } from '../../services/ordersApi'
import { getDeliveryPricing } from '../../services/deliveryApi'
import { getTelegramInitData, getTelegramUser } from '../../services/telegram'
import { cartItemIssue } from '../../services/cartReconciliation'
import { Icon } from '../../design-system/Icon'
import { ButtonLoading } from '../../design-system/ButtonLoading'
import { OtpCodeInput } from '../../design-system/OtpCodeInput'
import { DeliverySlotPicker } from './DeliverySlotPicker'
import { SavedAddressPicker } from './SavedAddressPicker'
import type { CheckoutStep } from '../cart/CartPage'
import { formatMoney, formatNumber } from '../../utils/format'
import {
  DeliveryMethod,
  PaymentMethod,
  type CartItem,
  type CreateOrderRequest,
  type CustomerAddressDto,
  type CustomerProfileDto,
  type DeliveryPricingDto,
  type OrderDto,
  type PublicOrderOptionsDto,
} from '../../types'

type FormState = { fullName: string; phoneNumber: string; addressLine: string; customerNote: string; deliveryMethod: DeliveryMethod; paymentMethod: PaymentMethod }
const initialForm: FormState = { fullName: '', phoneNumber: '', addressLine: '', customerNote: '', deliveryMethod: DeliveryMethod.Delivery, paymentMethod: PaymentMethod.Cash }
const newAddressValue = 'new'
type AuthenticationState = 'checking' | 'guest' | 'authenticated'
type LoginStep = 'phone' | 'code'
type LoginPurpose = 'checkout' | 'link'

export function CheckoutForm({ items, isCartVerified, isCheckingCart, onRefreshCart, onSuccess, onAuthenticationChange, wizardStep, onWizardStepChange, onDeliveryCostChange }: {
  items: CartItem[]
  isCartVerified: boolean
  isCheckingCart: boolean
  onRefreshCart: () => void
  onSuccess: (order: OrderDto) => void
  onAuthenticationChange: (authenticated: boolean) => void
  /** Which wizard step the page is on. Every field is always rendered; CSS shows the current step
   *  on phones and all of them on desktop, so the form never loses state between steps. */
  wizardStep?: CheckoutStep
  onWizardStepChange?: (step: CheckoutStep) => void
  /** Reports the courier charge upward so the cart step can show it too; the form stays the one
   *  place that fetches and interprets pricing. */
  onDeliveryCostChange?: (cost: { fee: number | null; isLoading: boolean }) => void
}) {
  const [form, setForm] = useState(initialForm)
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressDto[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>(newAddressValue)
  const [error, setError] = useState<string | null>(null)
  const [deliveryTimeSlotId, setDeliveryTimeSlotId] = useState<number | null>(null)
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null)
  // Bumped when the server refuses an order, so the window picker re-reads availability instead of
  // leaving the customer to press the button again on a window that has already closed or filled.
  const [slotRefreshSignal, setSlotRefreshSignal] = useState(0)
  const [isExpress, setIsExpress] = useState(false)
  const [pricing, setPricing] = useState<DeliveryPricingDto | null>(null)
  const [isLoadingPricing, setIsLoadingPricing] = useState(true)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [orderOptions, setOrderOptions] = useState<PublicOrderOptionsDto | null>(null)
  const [authentication, setAuthentication] = useState<AuthenticationState>('checking')
  const [authenticationMethod, setAuthenticationMethod] = useState<'telegram' | 'phone' | null>(null)
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileDto | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginPurpose, setLoginPurpose] = useState<LoginPurpose>('checkout')
  const [loginStep, setLoginStep] = useState<LoginStep>('phone')
  const [loginPhone, setLoginPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [authenticationMessage, setAuthenticationMessage] = useState<string | null>(null)
  const loginGateRef = useRef<HTMLElement>(null)
  const cartIssue = items.map(cartItemIssue).find((issue): issue is string => Boolean(issue)) ?? null
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const selectedSavedAddress = savedAddresses.find((address) => address.id.toString() === selectedAddressId)
  const selectedDelivery = orderOptions?.deliveryMethods.find((item) => item.method === form.deliveryMethod)
  // Both methods book a window from the same set; only the wording differs, because the window a
  // courier delivers in is the window a pickup customer collects in.
  const isPickup = form.deliveryMethod === DeliveryMethod.Pickup
  // Express and a delivery window are alternatives, never both: an express order is served as soon
  // as possible, so there is no window to book and the window step drops out of the wizard.
  const expressAvailable = Boolean(selectedDelivery?.supportsExpress)
  const expressChosen = expressAvailable && isExpress
  const expressFee = expressChosen ? selectedDelivery?.expressFee ?? 0 : 0
  const selectedPayment = orderOptions?.paymentMethods.find((item) => item.method === form.paymentMethod)
  const cartSubtotal = items.reduce((sum, item) =>
    sum + (item.unitPrice + (item.withPersianRice ? item.persianRicePrice ?? 0 : 0)) * item.quantity, 0)
  const isBelowMinimum = Boolean(selectedDelivery && cartSubtotal < selectedDelivery.minimumOrderAmount)
  // The charge always comes from the server's answer for the resolved delivery date, never from the
  // delivery-method record: for courier delivery the price is a property of the day, not the method.
  const selectedPricing = pricing?.methods.find((item) => item.method === form.deliveryMethod) ?? null
  const deliveryFee = selectedPricing?.customerDeliveryFee ?? null
  const isDeliveryUnpriced = Boolean(selectedPricing && deliveryFee === null)
  const finalTotal = cartSubtotal + (deliveryFee ?? 0) + expressFee

  const applyProfile = useCallback((profile: CustomerProfileDto, requireConfirmedPhone: boolean) => {
    setCustomerProfile(profile)
    setForm((current) => ({
      ...current,
      fullName: current.fullName || profile.preferredName,
      phoneNumber: requireConfirmedPhone && profile.defaultPhoneNumber
        ? profile.defaultPhoneNumber
        : current.phoneNumber || profile.defaultPhoneNumber,
    }))
    setSavedAddresses(profile.addresses)
    const defaultAddress = profile.addresses.find((address) => address.isDefault) ?? profile.addresses[0]
    if (defaultAddress) setSelectedAddressId(defaultAddress.id.toString())
  }, [])

  useEffect(() => {
    let isActive = true
    const loadProfile = async () => {
      setIsLoadingProfile(true)
      setProfileMessage(null)
      try {
        let session = await getCustomerSession()
        const initData = getTelegramInitData()
        if (!session.authenticated && initData) session = await loginCustomerWithTelegram(initData)
        const profile = session.profile
        if (!isActive) return
        if (session.authenticated && profile) {
          onAuthenticationChange(true)
          setAuthentication('authenticated')
          setAuthenticationMethod(session.method)
          applyProfile(profile, session.method === 'phone')
        } else {
          onAuthenticationChange(false)
          setAuthentication('guest')
          setAuthenticationMethod(null)
          setCustomerProfile(null)
        }
      } catch {
        if (isActive) {
          onAuthenticationChange(false)
          setAuthentication('guest')
          setAuthenticationMethod(null)
          setCustomerProfile(null)
          setProfileMessage('بررسی وضعیت ورود ممکن نشد. برای ثبت نهایی سفارش، ورود با موبایل دوباره بررسی می‌شود.')
        }
      } finally {
        if (isActive) setIsLoadingProfile(false)
      }
    }
    void loadProfile()
    return () => { isActive = false }
  }, [applyProfile])

  useEffect(() => {
    let active = true
    void getOrderOptions().then((options) => {
      if (!active) return
      setOrderOptions(options)
      const delivery = options.deliveryMethods[0]
      const payment = options.paymentMethods[0]
      if (delivery) setField('deliveryMethod', delivery.method)
      if (payment) setField('paymentMethod', payment.method)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت روش‌های سفارش ممکن نشد.')
    }).finally(() => { if (active) setIsLoadingOptions(false) })
    return () => { active = false }
  }, [])

  // Re-priced whenever the delivery date the picker resolved changes. Passing no date lets the
  // server decide the business day, exactly as the window picker does, so the browser clock can
  // never shift which day's price the customer is quoted.
  useEffect(() => {
    let active = true
    setIsLoadingPricing(true)
    getDeliveryPricing(deliveryDate ?? undefined)
      .then((result) => { if (active) setPricing(result) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت هزینه ارسال ممکن نشد.')
      })
      .finally(() => { if (active) setIsLoadingPricing(false) })
    return () => { active = false }
  }, [deliveryDate])

  useEffect(() => {
    if (!expressAvailable && isExpress) setIsExpress(false)
  }, [expressAvailable, isExpress])


  // Choosing express releases any window already picked, so a stale selection cannot be submitted.
  useEffect(() => {
    if (expressChosen) setDeliveryTimeSlotId(null)
  }, [expressChosen])

  useEffect(() => {
    onDeliveryCostChange?.({ fee: deliveryFee, isLoading: isLoadingPricing })
  }, [deliveryFee, isLoadingPricing, onDeliveryCostChange])

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  useEffect(() => {
    if (!showLogin) return
    const frame = window.requestAnimationFrame(() => loginGateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [showLogin])

  const sendOtp = async () => {
    setOtpError(null)
    if (!loginPhone.trim()) return setOtpError('شماره موبایل را وارد کنید.')
    setIsAuthenticating(true)
    try {
      await requestCustomerOtp(loginPhone)
      setField('phoneNumber', loginPhone.trim())
      setLoginStep('code')
      setResendSeconds(120)
    } catch (submitError) {
      setOtpError(submitError instanceof Error ? submitError.message : 'ارسال کد تایید ممکن نشد.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const verifyOtp = async () => {
    setOtpError(null)
    setIsAuthenticating(true)
    try {
      const session = await verifyCustomerOtp(loginPhone, otpCode)
      if (!session.authenticated || !session.profile) throw new Error('ورود به حساب کامل نشد.')
      setAuthentication('authenticated')
      onAuthenticationChange(true)
      setAuthenticationMethod(session.method)
      applyProfile(session.profile, true)
      setShowLogin(false)
      setLoginStep('phone')
      setOtpCode('')
      setAuthenticationMessage(loginPurpose === 'link'
        ? 'موبایل و تلگرام به یک حساب متصل شدند. آدرس‌ها و سفارش‌های مرتبط بازیابی شد.'
        : 'ورود با موفقیت انجام شد. اطلاعات تحویل را بررسی و سفارش را ثبت کنید.')
    } catch (submitError) {
      setOtpError(submitError instanceof Error ? submitError.message : 'کد تایید پذیرفته نشد.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  /**
   * Everything the delivery step is responsible for. One definition serves both the wizard's
   * «ادامه» button and the final submission, so a phone customer can never step past a field that
   * would stop the order two screens later.
   */
  const deliveryStepError = () => {
    if (!form.fullName.trim()) return 'نام و نام خانوادگی الزامی است.'
    if (!form.phoneNumber.trim()) return 'شماره موبایل الزامی است.'
    if (form.deliveryMethod === DeliveryMethod.Delivery && !selectedSavedAddress && !form.addressLine.trim()) return 'آدرس برای ارسال سفارش الزامی است.'
    return null
  }

  /** The window step. Server revalidates atomically; this only saves the customer a round trip. */
  const timeStepError = () =>
    expressChosen || deliveryTimeSlotId != null ? null : 'برای ادامه، یک بازه زمانی تحویل انتخاب کنید.'

  const advanceTo = (next: CheckoutStep, stepError: string | null) => {
    setError(stepError)
    if (!stepError) onWizardStepChange?.(next)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    // On a phone the offending field is on an earlier screen, so say what is wrong and go back to
    // where it can be fixed.
    const earlierStepError = deliveryStepError() ?? timeStepError()
    if (earlierStepError) {
      onWizardStepChange?.(deliveryStepError() ? 'delivery' : 'time')
      return setError(earlierStepError)
    }
    if (items.length === 0) return setError('حداقل یک غذا به سبد خرید اضافه کنید.')
    if (!selectedDelivery || !selectedPayment) return setError('روش پرداخت یا دریافت معتبری انتخاب نشده است.')
    if (isBelowMinimum) return setError(`حداقل مبلغ سفارش برای این روش ${formatMoney(selectedDelivery.minimumOrderAmount)} است.`)
    // A day nobody has priced is not a free-delivery day. The server refuses such an order anyway;
    // stopping here saves the customer a round trip and an unexplained failure.
    if (isDeliveryUnpriced) return setError(selectedPricing!.unavailableMessage ?? 'هزینه ارسال برای این روز مشخص نشده است.')
    if (isCheckingCart) return setError('لطفاً تا پایان بررسی موجودی صبر کنید.')
    if (!isCartVerified) return setError('پیش از ثبت سفارش، موجودی سبد را دوباره بررسی کنید.')
    if (cartIssue) return setError(cartIssue)
    if (items.some((item) => item.quantity <= 0)) return setError('تعداد یکی از غذاها معتبر نیست.')
    if (authentication === 'checking') return setError('لطفاً تا پایان بررسی وضعیت ورود صبر کنید.')
    if (authentication !== 'authenticated') {
      if (!showLogin) {
        setLoginPurpose('checkout')
        setLoginPhone(form.phoneNumber.trim())
        setLoginStep('phone')
        setOtpCode('')
        setOtpError(null)
        setShowLogin(true)
      } else if (loginStep === 'phone') {
        void sendOtp()
      } else {
        void verifyOtp()
      }
      return
    }

    const telegramUser = getTelegramUser()
    const selectedAddressForOrder = form.deliveryMethod === DeliveryMethod.Delivery ? selectedSavedAddress : undefined
    const request: CreateOrderRequest = {
      telegramInitData: getTelegramInitData(),
      telegramUserId: telegramUser?.id ?? null,
      telegramUsername: telegramUser?.username ?? null,
      fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim(), city: 'اندیمشک',
      customerAddressId: selectedAddressForOrder?.id ?? null,
      newAddressTitle: 'آدرس اصلی',
      saveAddress: form.deliveryMethod === DeliveryMethod.Delivery && !selectedAddressForOrder,
      addressLine: form.deliveryMethod === DeliveryMethod.Delivery
        ? selectedAddressForOrder ? null : form.addressLine.trim()
        : 'تحویل حضوری',
      customerNote: form.customerNote.trim() || null,
      deliveryMethod: form.deliveryMethod, paymentMethod: form.paymentMethod,
      deliveryTimeSlotId: expressChosen ? null : deliveryTimeSlotId,
      isExpress: expressChosen,
      items: items.map((item) => ({ dailyMenuItemId: item.dailyMenuItemId, withPersianRice: Boolean(item.withPersianRice), quantity: item.quantity })),
    }
    setIsSubmitting(true)
    try { onSuccess(await createOrder(request)) }
    catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ثبت سفارش ناموفق بود.')
      onRefreshCart()
      setSlotRefreshSignal((signal) => signal + 1)
    }
    finally { setIsSubmitting(false) }
  }

  return <form className="panel form-grid checkout-form" onSubmit={submit} noValidate>
    {/* Desktop shows the whole form under one title; the wizard names each step instead. Account
        state and the login gate belong to no single step — the gate can open from the identity card
        in one step and from the final submission in another — so they stay outside the step blocks
        and remain on screen throughout. */}
    <h2 className="section-title checkout-desktop-only">اطلاعات تحویل</h2>
    {isLoadingProfile && <p className="muted">در حال بررسی اطلاعات قبلی شما…</p>}
    {profileMessage && <div className="form-hint">{profileMessage}</div>}
    {authenticationMessage && <div className="checkout-auth-success" role="status"><Icon name="confirm" size="sm" />{authenticationMessage}</div>}
    {authentication === 'authenticated' && customerProfile && <section className="checkout-customer-identity" aria-label="هویت متصل به سفارش">
      <div className="checkout-customer-identity-icon"><Icon name="profile" size="md" /></div>
      <div className="checkout-customer-identity-copy">
        <strong>{authenticationMethod === 'telegram' ? 'ورود امن با تلگرام' : 'ورود با موبایل تاییدشده'}</strong>
        {customerProfile.telegramUserId != null && <span>
          {customerProfile.telegramUsername ? <bdi>@{customerProfile.telegramUsername}</bdi> : 'حساب تلگرام'}
          <small>شناسه تلگرام: <bdi>{customerProfile.telegramUserId}</bdi></small>
        </span>}
        {customerProfile.phoneNumberConfirmed
          ? <span className="checkout-linked-phone"><Icon name="confirm" size="xs" /> موبایل متصل: <bdi>{customerProfile.defaultPhoneNumber}</bdi></span>
          : <span className="checkout-unlinked-phone">موبایل هنوز به این حساب متصل نشده است.</span>}
      </div>
      {authenticationMethod === 'telegram' && !customerProfile.phoneNumberConfirmed && <button type="button" className="outline-button checkout-link-phone" onClick={() => {
        setLoginPurpose('link')
        setLoginPhone(form.phoneNumber.trim())
        setLoginStep('phone')
        setOtpCode('')
        setOtpError(null)
        setShowLogin(true)
      }}>اتصال موبایل و بازیابی آدرس‌ها</button>}
    </section>}
    {showLogin && <section ref={loginGateRef} className="checkout-login-gate" aria-labelledby="checkout-login-title">
      <header>
        <span><Icon name="profile" size="md" /></span>
        <div>
          <h3 id="checkout-login-title">{loginPurpose === 'link' ? 'اتصال موبایل به حساب تلگرام' : 'ورود برای ثبت سفارش'}</h3>
          <p>{loginPurpose === 'link'
            ? 'پس از تایید، آدرس‌ها و سفارش‌های این موبایل به همین حساب امن تلگرام متصل می‌شوند.'
            : 'سبد و اطلاعاتی که وارد کرده‌اید حفظ می‌شود.'}</p>
        </div>
      </header>
      {loginStep === 'phone' ? <>
        <label className="field">شماره موبایل
          <input className="ltr-value" dir="ltr" inputMode="tel" autoComplete="tel" value={loginPhone}
            onChange={(event) => { setLoginPhone(event.target.value); setField('phoneNumber', event.target.value) }} placeholder="09121234567" />
        </label>
        <button type="button" className="primary-button full-width" disabled={isAuthenticating} onClick={() => void sendOtp()}>
          {isAuthenticating ? 'در حال ارسال…' : 'ارسال کد ورود'}
        </button>
      </> : <>
        <p className="muted">کد شش‌رقمی ارسال‌شده به <bdi>{loginPhone}</bdi> را وارد کنید.</p>
        <OtpCodeInput value={otpCode} onChange={setOtpCode} autoFocus />
        <button type="button" className="primary-button full-width" disabled={isAuthenticating || otpCode.length !== 6} onClick={() => void verifyOtp()}>
          {isAuthenticating ? 'در حال بررسی…' : 'تایید و ادامه'}
        </button>
        <div className="otp-actions">
          <button type="button" className="outline-button" onClick={() => { setLoginStep('phone'); setOtpCode(''); setOtpError(null) }}>تغییر شماره</button>
          <button type="button" className="outline-button" disabled={resendSeconds > 0 || isAuthenticating} onClick={() => void sendOtp()}>
            {resendSeconds > 0 ? `ارسال دوباره تا ${formatNumber(resendSeconds)} ثانیه` : 'ارسال دوباره'}
          </button>
        </div>
      </>}
      {otpError && <div className="form-error" role="alert">{otpError}</div>}
      <button type="button" className="checkout-login-cancel" onClick={() => { setShowLogin(false); setOtpError(null) }}>
        {loginPurpose === 'link' ? 'فعلاً بدون اتصال ادامه می‌دهم' : 'فعلاً نه؛ بازگشت به سبد'}
      </button>
    </section>}
    <div className="checkout-step-block" data-step="delivery">
      <h2 className="section-title checkout-step-heading checkout-mobile-only">اطلاعات تحویل</h2>
      <label className="field">نام و نام خانوادگی<input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} autoComplete="name" /></label>
      <label className="field">شماره موبایل{authentication === 'guest' ? ' (برای ورود و پیگیری سفارش)' : ''}<input className="ltr-value" dir="ltr" value={form.phoneNumber} onChange={(e) => setField('phoneNumber', e.target.value)} inputMode="tel" autoComplete="tel" readOnly={authenticationMethod === 'phone'} /></label>
      {/* The two method selects share one row on desktop but belong to different wizard steps, so
          each is rendered twice: the paired row for desktop and a single field for its own step.
          They read and write the same state, and only one copy is ever displayed. */}
      <label className="field checkout-mobile-only">روش دریافت<select value={form.deliveryMethod} onChange={(e) => setField('deliveryMethod', Number(e.target.value) as DeliveryMethod)}>
        {orderOptions?.deliveryMethods.map((item) => <option key={item.method} value={item.method}>{item.title}</option>)}
      </select></label>
    </div>

    <div className="form-grid two-columns checkout-desktop-only">
      <label className="field">روش دریافت<select value={form.deliveryMethod} onChange={(e) => setField('deliveryMethod', Number(e.target.value) as DeliveryMethod)}>
        {orderOptions?.deliveryMethods.map((item) => <option key={item.method} value={item.method}>{item.title}</option>)}
      </select></label>
      <label className="field">روش پرداخت<select value={form.paymentMethod} onChange={(e) => setField('paymentMethod', Number(e.target.value) as PaymentMethod)}>
        {orderOptions?.paymentMethods.map((item) => <option key={item.method} value={item.method}>{item.title}</option>)}
      </select></label>
    </div>

    <div className="checkout-step-block" data-step="payment">
      <h2 className="section-title checkout-step-heading checkout-mobile-only">پرداخت و تایید</h2>
      <label className="field checkout-mobile-only">روش پرداخت<select value={form.paymentMethod} onChange={(e) => setField('paymentMethod', Number(e.target.value) as PaymentMethod)}>
        {orderOptions?.paymentMethods.map((item) => <option key={item.method} value={item.method}>{item.title}</option>)}
      </select></label>
      <div className="form-hint">{selectedPayment?.description}</div>
      {isBelowMinimum && <div className="form-error" role="alert">حداقل مبلغ سفارش برای این روش {formatMoney(selectedDelivery!.minimumOrderAmount)} است.</div>}
    </div>

    <div className="checkout-step-block" data-step="delivery">
      {form.deliveryMethod === DeliveryMethod.Delivery && savedAddresses.length > 0 && <SavedAddressPicker
        addresses={savedAddresses}
        selectedAddressId={selectedAddressId}
        newAddressValue={newAddressValue}
        onSelect={setSelectedAddressId}
      />}
      {form.deliveryMethod === DeliveryMethod.Delivery && !selectedSavedAddress && <label className="field">آدرس<textarea value={form.addressLine} onChange={(e) => setField('addressLine', e.target.value)} /></label>}
      {wizardStep === 'delivery' && error && <div className="form-error" role="alert">{error}</div>}
      <div className="checkout-wizard-actions">
        <button type="button" className="outline-button" onClick={() => onWizardStepChange?.('cart')}>مرحله قبل</button>
        <button type="button" className="primary-button" onClick={() => advanceTo('time', deliveryStepError())}>ادامه به زمان تحویل <Icon name="back" size="sm" /></button>
      </div>
    </div>

    <div className="checkout-step-block" data-step="time">
      <h2 className="section-title checkout-step-heading checkout-mobile-only">زمان تحویل</h2>
      {/* Express belongs with the times, because it is the answer to the same question: when. Picking
          it puts the window list out of use rather than hiding it, so the customer can see what they
          are giving up and change their mind. */}
      {expressAvailable && <label className={`express-option ${expressChosen ? 'is-selected' : ''}`}>
        <input type="checkbox" checked={expressChosen} onChange={(event) => setIsExpress(event.target.checked)} />
        <span className="express-option-copy">
          <strong><Icon name="clock" size="sm" /> ارسال فوری</strong>
          <small>
            {selectedDelivery?.expressEstimatedMinutes
              ? `تحویل تا حدود ${formatNumber(selectedDelivery.expressEstimatedMinutes)} دقیقه دیگر، بدون انتخاب بازه`
              : 'در سریع‌ترین زمان ممکن، بدون انتخاب بازه'}
            {(selectedDelivery?.expressFee ?? 0) > 0 && ` — ${formatMoney(selectedDelivery!.expressFee)} هزینه اضافه`}
          </small>
        </span>
      </label>}
      <div className={expressChosen ? 'delivery-slot-disabled' : undefined} aria-hidden={expressChosen || undefined}>
        <DeliverySlotPicker selectedSlotId={deliveryTimeSlotId} onSelect={setDeliveryTimeSlotId} onDateResolved={setDeliveryDate} refreshSignal={slotRefreshSignal} isPickup={isPickup} />
      </div>
      {wizardStep === 'time' && error && <div className="form-error" role="alert">{error}</div>}
      <div className="checkout-wizard-actions">
        <button type="button" className="outline-button" onClick={() => onWizardStepChange?.('delivery')}>مرحله قبل</button>
        <button type="button" className="primary-button" onClick={() => advanceTo('payment', timeStepError())}>ادامه به پرداخت <Icon name="back" size="sm" /></button>
      </div>
    </div>

    <div className="checkout-step-block" data-step="payment">
      <label className="field">توضیح سفارش<textarea value={form.customerNote} onChange={(e) => setField('customerNote', e.target.value)} /></label>

      {/* The delivery charge is shown as its own line, never folded into the total: the customer should
          be able to read غذا + ارسال = پرداختی without doing arithmetic to find the difference. */}
      <section className="checkout-totals" aria-label="خلاصه مبلغ سفارش">
        <div><span>جمع غذاها</span><strong>{formatMoney(cartSubtotal)}</strong></div>
        <div>
          <span>هزینه ارسال</span>
          <strong>{isLoadingPricing
            ? 'در حال محاسبه…'
            : deliveryFee === null ? 'مشخص نشده' : formatMoney(deliveryFee)}</strong>
        </div>
        {expressChosen && <div>
          <span>ارسال فوری</span>
          <strong>{formatMoney(expressFee)}</strong>
        </div>}
        <div className="checkout-totals-final">
          <span>مبلغ نهایی</span>
          <strong>{isLoadingPricing || deliveryFee === null ? '—' : formatMoney(finalTotal)}</strong>
        </div>
      </section>
      {isDeliveryUnpriced && <div className="form-error" role="alert">
        {selectedPricing?.unavailableMessage ?? 'هزینه ارسال برای این روز مشخص نشده است.'}
      </div>}

      {wizardStep !== 'delivery' && wizardStep !== 'time' && error && <div className="form-error" role="alert">{error}</div>}
      {/* The final action shares the pinned bar with «مرحله قبل» on a phone. On desktop the bar is
          `display: contents`, so the submit button stays an ordinary last child of the form. */}
      <div className="checkout-wizard-actions checkout-submit-actions">
      <button type="button" className="outline-button checkout-mobile-only" onClick={() => onWizardStepChange?.('time')}>مرحله قبل</button>
      <button className="primary-button full-width" disabled={isSubmitting || isCheckingCart || isLoadingProfile || isLoadingOptions || isLoadingPricing || isDeliveryUnpriced || showLogin || !isCartVerified || Boolean(cartIssue) || isBelowMinimum || !selectedDelivery || !selectedPayment || items.length === 0 || (!expressChosen && deliveryTimeSlotId == null)}>{isSubmitting
        ? <ButtonLoading label={form.deliveryMethod === DeliveryMethod.Delivery && !selectedSavedAddress ? 'در حال ثبت سفارش و آدرس…' : 'در حال ثبت سفارش…'} />
        : isCheckingCart ? 'در حال بررسی موجودی…' : authentication === 'guest' ? 'ورود و ثبت سفارش' : 'ثبت سفارش'}</button>
      </div>
    </div>
  </form>
}
