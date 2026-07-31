import { useEffect, useState, type FormEvent } from 'react'
import { getCustomerSession, loginCustomerWithTelegram } from '../../services/customerApi'
import { createOrder } from '../../services/ordersApi'
import { getTelegramInitData, getTelegramUser } from '../../services/telegram'
import { DeliveryMethod, PaymentMethod, type CartItem, type CreateOrderRequest, type CustomerAddressDto, type OrderDto } from '../../types'

type FormState = { fullName: string; phoneNumber: string; addressLine: string; customerNote: string; deliveryMethod: DeliveryMethod; paymentMethod: PaymentMethod }
const initialForm: FormState = { fullName: '', phoneNumber: '', addressLine: '', customerNote: '', deliveryMethod: DeliveryMethod.Delivery, paymentMethod: PaymentMethod.CardToCard }
const newAddressValue = 'new'

export function CheckoutForm({ items, onSuccess }: { items: CartItem[]; onSuccess: (order: OrderDto) => void }) {
  const [form, setForm] = useState(initialForm)
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddressDto[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>(newAddressValue)
  const [error, setError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const selectedSavedAddress = savedAddresses.find((address) => address.id.toString() === selectedAddressId)

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
        if (!isActive || profile === null) return
        setForm((current) => ({
          ...current,
          fullName: current.fullName || profile.preferredName,
          phoneNumber: current.phoneNumber || profile.defaultPhoneNumber,
        }))
        setSavedAddresses(profile.addresses)
        const defaultAddress = profile.addresses.find((address) => address.isDefault) ?? profile.addresses[0]
        if (defaultAddress) setSelectedAddressId(defaultAddress.id.toString())
      } catch {
        if (isActive) setProfileMessage('دریافت اطلاعات قبلی شما ممکن نشد. می‌توانید سفارش را دستی ثبت کنید.')
      } finally {
        if (isActive) setIsLoadingProfile(false)
      }
    }
    void loadProfile()
    return () => { isActive = false }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!form.fullName.trim()) return setError('نام و نام خانوادگی الزامی است.')
    if (!form.phoneNumber.trim()) return setError('شماره موبایل الزامی است.')
    if (form.deliveryMethod === DeliveryMethod.Delivery && !selectedSavedAddress && !form.addressLine.trim()) return setError('آدرس برای ارسال سفارش الزامی است.')
    if (items.length === 0) return setError('حداقل یک غذا به سبد خرید اضافه کنید.')
    if (items.some((item) => item.quantity <= 0 || item.quantity > item.remainingPortions)) return setError('تعداد یکی از غذاها معتبر نیست.')

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
      items: items.map((item) => ({ dailyMenuItemId: item.dailyMenuItemId, quantity: item.quantity })),
    }
    setIsSubmitting(true)
    try { onSuccess(await createOrder(request)) }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'ثبت سفارش ناموفق بود.') }
    finally { setIsSubmitting(false) }
  }

  return <form className="panel form-grid" onSubmit={submit} noValidate>
    <h2 className="section-title">اطلاعات تحویل</h2>
    {isLoadingProfile && <p className="muted">در حال بررسی اطلاعات قبلی شما…</p>}
    {profileMessage && <div className="form-hint">{profileMessage}</div>}
    <label className="field">نام و نام خانوادگی<input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} autoComplete="name" /></label>
    <label className="field">شماره موبایل<input className="ltr-value" dir="ltr" value={form.phoneNumber} onChange={(e) => setField('phoneNumber', e.target.value)} inputMode="tel" autoComplete="tel" /></label>
    <div className="form-grid two-columns">
      <label className="field">روش دریافت<select value={form.deliveryMethod} onChange={(e) => setField('deliveryMethod', Number(e.target.value) as DeliveryMethod)}>
        <option value={DeliveryMethod.Delivery}>ارسال</option><option value={DeliveryMethod.Pickup}>تحویل حضوری</option>
      </select></label>
      <label className="field">روش پرداخت<select value={form.paymentMethod} onChange={(e) => setField('paymentMethod', Number(e.target.value) as PaymentMethod)}>
        <option value={PaymentMethod.CardToCard}>کارت‌به‌کارت</option><option value={PaymentMethod.Cash}>نقدی</option>
        <option value={PaymentMethod.Pos}>دستگاه پوز</option><option value={PaymentMethod.Online}>پرداخت آنلاین</option>
      </select></label>
    </div>
    <div className="form-hint">
      {form.paymentMethod === PaymentMethod.CardToCard && 'پس از واریز، پرداخت شما در انتظار تأیید مدیریت خواهد بود.'}
      {form.paymentMethod === PaymentMethod.Cash && 'وجه نقد هنگام تحویل یا دریافت حضوری پرداخت می‌شود.'}
      {form.paymentMethod === PaymentMethod.Pos && 'پرداخت با دستگاه پوز هنگام تحویل یا دریافت حضوری انجام می‌شود.'}
      {form.paymentMethod === PaymentMethod.Online && 'پس از ثبت سفارش به مرحله پرداخت آنلاین هدایت می‌شوید.'}
    </div>
    {form.deliveryMethod === DeliveryMethod.Delivery && savedAddresses.length > 0 && <label className="field">آدرس‌های ذخیره‌شده<select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>
      {savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.title}{address.isDefault ? ' - پیش‌فرض' : ''}</option>)}
      <option value={newAddressValue}>افزودن آدرس جدید</option>
    </select></label>}
    {form.deliveryMethod === DeliveryMethod.Delivery && selectedSavedAddress && <div className="saved-address-card">
      <strong>{selectedSavedAddress.title}</strong>
      <span>{selectedSavedAddress.city}، {selectedSavedAddress.addressLine}</span>
    </div>}
    {form.deliveryMethod === DeliveryMethod.Delivery && !selectedSavedAddress && <label className="field">آدرس<textarea value={form.addressLine} onChange={(e) => setField('addressLine', e.target.value)} /></label>}
    <label className="field">توضیح سفارش<textarea value={form.customerNote} onChange={(e) => setField('customerNote', e.target.value)} /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="primary-button full-width" disabled={isSubmitting || items.length === 0}>{isSubmitting ? 'در حال ثبت سفارش…' : 'ثبت سفارش'}</button>
  </form>
}
