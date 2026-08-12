import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  type AdminDashboardSummaryDto,
  type CustomerAnalyticsTodayDto,
  type CreateOrderRequest,
  type DailyMenuDto,
  type FoodCategoryDto,
  type FoodCategoryWriteRequest,
  type FoodDto,
  type FoodTagDto,
  type FoodTagWriteRequest,
  type FoodWriteRequest,
  type IngredientDto,
  type OrderDto,
  type OrderReportQuery,
  type OrderSummaryDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { PersianDatePicker } from './PersianDatePicker'
import { formatMoney as money, formatNumber, persianDateWithLatinDigitsLocale } from './number-format'
import { FinancePage, IngredientsPage, InventoryPage, PaymentsPage, PurchasesPage, RecipesPage, ShoppingPage, SuppliersPage, V15ReportsPage } from './V15Pages'
import { DeliveryDaysPage, DeliverySlotsPage } from './DeliveryPages'
import { LogsPage } from './LogsPage'
import {
  SocialChannelsPage,
  SocialComposerPage,
  SocialDashboardPage,
  SocialHistoryPage,
  SocialRulesPage,
  SocialSuggestionsPage,
  SocialTemplatesPage,
} from './SocialPages'
import {
  navigationGroupForPage,
  navigationGroups,
  navigationPage,
  toggleNavigationGroup,
  type NavigationGroupId,
  type Page,
} from './admin-navigation'

const localAdmin: Record<'username' | 'password', string> = {
  username: 'admin',
  password: '',
}

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

const plainNumber = (value: number) => value.toString()
const groupedNumber = (value: number) => formatNumber(value)
const normalizedFoodName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa-IR')
const asciiDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
const integerDigits = (value: string) => asciiDigits(value).replace(/\D/g, '')
const parseMoneyInput = (value: string) => Number(asciiDigits(value).replace(/[,\s٬،]/g, '')) || 0
const formatMoneyInput = (value: number) => value > 0 ? groupedNumber(value) : ''
const persianOnes = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه']
const persianTeens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده']
const persianTens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
const persianHundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
const persianScales = ['', 'هزار', 'میلیون', 'میلیارد']
const joinPersianParts = (parts: string[]) => parts.filter(Boolean).join(' و ')
const underThousandToWords = (value: number): string => {
  const hundred = Math.floor(value / 100)
  const rest = value % 100
  const parts = [persianHundreds[hundred] ?? '']
  if (rest >= 10 && rest < 20) parts.push(persianTeens[rest - 10] ?? '')
  else {
    parts.push(persianTens[Math.floor(rest / 10)] ?? '')
    parts.push(persianOnes[rest % 10] ?? '')
  }
  return joinPersianParts(parts)
}
const numberToPersianWords = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return 'صفر تومان'
  const groups: string[] = []
  let remaining = Math.floor(value)
  let scale = 0
  while (remaining > 0) {
    const group = remaining % 1000
    if (group > 0) groups.unshift(joinPersianParts([underThousandToWords(group), persianScales[scale] ?? '']))
    remaining = Math.floor(remaining / 1000)
    scale += 1
  }
  return `${joinPersianParts(groups)} تومان`
}
const dateTime = (value: string) => {
  const date = new Date(value)
  const timeText = new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran',
  }).format(date)
  const dateText = new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tehran',
  }).format(date)
  return `${timeText} ${dateText}`
}

const statusLabel: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'در انتظار تایید',
  [OrderStatus.Confirmed]: 'تایید شده',
  [OrderStatus.Preparing]: 'در حال آماده‌سازی',
  [OrderStatus.Ready]: 'آماده تحویل',
  [OrderStatus.Delivered]: 'تحویل شده',
  [OrderStatus.Cancelled]: 'لغو شده',
}

const paymentMethodLabel: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: 'نقدی',
  [PaymentMethod.CardToCard]: 'کارت‌به‌کارت',
  [PaymentMethod.Online]: 'آنلاین',
  [PaymentMethod.Pos]: 'دستگاه پوز',
}

const deliveryMethodLabel: Record<DeliveryMethod, string> = {
  [DeliveryMethod.Pickup]: 'تحویل حضوری',
  [DeliveryMethod.Delivery]: 'ارسال',
}

/** Delivery window from the order's own snapshot; master-data edits never rewrite an old order. */
const deliveryWindowLabel = (order: {
  deliveryDate?: string | null
  deliveryStartTime?: string | null
  deliveryEndTime?: string | null
}) => order.deliveryDate && order.deliveryStartTime && order.deliveryEndTime
  // The stored value is an ISO business date; operators read Jalali everywhere else in Admin.
  ? `${new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, {
      timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(`${order.deliveryDate}T12:00:00+03:30`))} — ${order.deliveryStartTime} تا ${order.deliveryEndTime}`
  : 'زمان تحویل ثبت نشده'


type ToastMessage = {
  id: number
  kind: 'success' | 'error'
  message: string
}

function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  useEffect(() => {
    const showToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, 'id'>>).detail
      if (!detail?.message) return
      const toast = { ...detail, id: Date.now() + Math.random() }
      setToasts((current) => [...current.slice(-2), toast])
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id))
      }, detail.kind === 'error' ? 5200 : 3600)
    }
    window.addEventListener('kafgir:toast', showToast)
    return () => window.removeEventListener('kafgir:toast', showToast)
  }, [])
  if (toasts.length === 0) return null
  return <div className="toast-viewport" role="status" aria-live="polite">
    {toasts.map((toast) => <div className={`toast toast-${toast.kind}`} key={toast.id}>
      <strong>{toast.kind === 'success' ? 'موفق' : 'خطا'}</strong>
      <span>{toast.message}</span>
    </div>)}
  </div>
}

function Logo({ full = false }: { full?: boolean }) {
  return <div className={`brand-lockup ${full ? 'brand-lockup-full' : ''}`}>
    <img src="/branding/logo.png" alt="کفگیر" />
  </div>
}

function Status({ value }: { value: OrderStatus }) {
  return <span className={`badge status-${value}`}>{statusLabel[value]}</span>
}

function Message({ error, children }: { error?: string | null; children?: ReactNode }) {
  if (!error && !children) return null
  return <div className={error ? 'message error' : 'message'} role={error ? 'alert' : 'status'}>
    {error && <span>{error}</span>}
    {children}
  </div>
}

function AdminOrderInvoice({ order }: { order: OrderDto }) {
  return <article className="admin-invoice" aria-labelledby={`admin-invoice-title-${order.id}`}>
    <header className="admin-invoice-header">
      <Logo />
      <div>
        <span>فاکتور فروش</span>
        <h2 id={`admin-invoice-title-${order.id}`}>سفارش <bdi dir="ltr">{order.orderNumber}</bdi></h2>
      </div>
      <Status value={order.status} />
    </header>

    <section className="admin-invoice-meta">
      <div><span>تاریخ و زمان</span><strong>{dateTime(order.createdAt)}</strong></div>
      <div><span>نام مشتری</span><strong>{order.customerFullName}</strong></div>
      <div><span>شماره تماس</span><strong dir="ltr">{order.customerPhoneNumber}</strong></div>
      <div><span>روش دریافت</span><strong>{deliveryMethodLabel[order.deliveryMethod]}</strong></div>
      <div><span>زمان تحویل</span><strong>{deliveryWindowLabel(order)}</strong></div>
      <div><span>روش پرداخت</span><strong>{paymentMethodLabel[order.paymentMethod]}</strong></div>
      {order.addressLine && <div className="admin-invoice-address"><span>آدرس</span><strong>{order.addressLine}</strong></div>}
    </section>

    <div className="admin-invoice-table-wrap">
      <table className="admin-invoice-table">
        <thead><tr><th>ردیف</th><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead>
        <tbody>{order.items.map((item, index) => <tr key={item.id}>
          <td>{plainNumber(index + 1)}</td>
          <td>{item.foodName}</td>
          <td>{plainNumber(item.quantity)}</td>
          <td>{money(item.unitPrice)}</td>
          <td>{money(item.totalPrice)}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <section className="admin-invoice-summary">
      <div><span>جمع اقلام</span><strong>{money(order.subtotalAmount)}</strong></div>
      <div><span>هزینه ارسال</span><strong>{money(order.deliveryFee)}</strong></div>
      <div className="admin-invoice-total"><span>مبلغ قابل پرداخت</span><strong>{money(order.totalAmount)}</strong></div>
    </section>
    {order.customerNote && <section className="admin-invoice-note"><strong>یادداشت مشتری</strong><p>{order.customerNote}</p></section>}
    <footer className="admin-invoice-footer">
      <span>کفگیر؛ غذای خانگی با مهر</span>
      <span dir="ltr">09166450262 · 09163442440</span>
    </footer>
  </article>
}

function InvoiceDialog({ order, onClose }: { order: OrderDto; onClose: () => void }) {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const printInvoice = async () => {
    setIsPrinting(true)
    setPrintError(null)
    try { await window.kafgir.printInvoice() }
    catch (reason) { setPrintError(reason instanceof Error ? reason.message : 'چاپ فاکتور ممکن نشد.') }
    finally { setIsPrinting(false) }
  }
  return <div className="invoice-dialog" role="dialog" aria-modal="true" aria-label={`فاکتور سفارش ${order.orderNumber}`}>
    <button type="button" className="invoice-dialog-backdrop" aria-label="بستن فاکتور" onClick={onClose} />
    <div className="invoice-dialog-card">
      <div className="invoice-dialog-actions">
        {printError && <span className="invoice-print-error" role="alert">{printError}</span>}
        <button type="button" className="secondary-outline" onClick={onClose}>بستن</button>
        <button type="button" className="primary" disabled={isPrinting} onClick={() => void printInvoice()}>
          {isPrinting ? 'در حال باز کردن چاپ…' : 'چاپ یا ذخیره فاکتور'}
        </button>
      </div>
      <AdminOrderInvoice order={order} />
    </div>
  </div>
}

function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [username, setUsername] = useState(localAdmin.username)
  const [password, setPassword] = useState(localAdmin.password)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const checkHealth = useCallback(async () => {
    setOnline(null)
    try {
      await adminApi.health()
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])
  useEffect(() => {
    void checkHealth()
  }, [checkHealth])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await adminApi.login(username, password)
      onLogin(response.fullName)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ورود ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="login-page">
    <form className="login-card" onSubmit={submit}>
      <Logo full />
      <h1>ورود به مدیریت کفگیر</h1>
      {online === false && <Message error="ارتباط با سرور برقرار نشد.">
        <button type="button" onClick={() => void checkHealth()}>تلاش دوباره</button>
      </Message>}
      <label>نام کاربری<input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus /></label>
      <label>رمز عبور<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <Message error={error} />
      <button className="primary" disabled={busy || online === false}>{busy ? 'در حال ورود…' : 'ورود'}</button>
    </form>
  </main>
}

function PageFrame({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="page">
    <header className="page-header"><h1>{title}</h1><div className="page-actions">{actions}</div></header>
    {children}
  </section>
}

function DashboardPage() {
  const [data, setData] = useState<AdminDashboardSummaryDto | null>(null)
  const [operations, setOperations] = useState<Awaited<ReturnType<typeof adminApi.v15Dashboard>> | null>(null)
  const [analytics, setAnalytics] = useState<CustomerAnalyticsTodayDto | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const analyticsLoading = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [summary, operational] = await Promise.all([adminApi.dashboard(), adminApi.v15Dashboard()])
      setData(summary); setOperations(operational)
    } catch (reason) { setError(String(reason)) }
  }, [])
  const loadAnalytics = useCallback(async () => {
    if (analyticsLoading.current || document.visibilityState !== 'visible') return
    analyticsLoading.current = true
    try {
      setAnalytics(await adminApi.customerAnalytics())
      setAnalyticsError(null)
    } catch {
      setAnalyticsError('به‌روزرسانی آمار کاربران انجام نشد؛ آخرین مقادیر معتبر نمایش داده می‌شوند.')
    } finally {
      analyticsLoading.current = false
      setAnalyticsLoaded(true)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void loadAnalytics()
    const timer = window.setInterval(() => void loadAnalytics(), 30_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void loadAnalytics() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadAnalytics])
  const cards = data ? [
    ['کل سفارش‌ها', plainNumber(data.totalOrders)],
    ['در انتظار تایید', plainNumber(data.pendingOrders)],
    ['تایید شده', plainNumber(data.confirmedOrders)],
    ['تحویل شده', plainNumber(data.deliveredOrders)],
    ['لغو شده', plainNumber(data.cancelledOrders)],
    ['تعداد پرس', plainNumber(data.totalPortions)],
    ['فروش تایید شده', money(data.confirmedSales)],
    ['فروش تحویل داده شده', money(data.deliveredSales)],
  ] : []
  const analyticsCards: Array<[string, string, string, string]> = analytics ? [
    ['unique-visitors', 'بازدیدکنندگان یکتای امروز', groupedNumber(analytics.uniqueVisitorsToday), 'تعداد بازدیدکنندگان یکتایی که از ابتدای امروز تا اکنون حداقل یک فعالیت در کفگیر داشته‌اند. برای شمارش بازدیدکننده، ورود به حساب کاربری الزامی نیست.'],
    ['online-now', 'آنلاین الان', groupedNumber(analytics.onlineNow), 'تعداد بازدیدکنندگانی که در ۵ دقیقه اخیر در کفگیر فعال بوده‌اند. این عدد تقریبی است و بر اساس آخرین زمان فعالیت کاربر محاسبه می‌شود.'],
    ['guest-visitors', 'مهمان‌های امروز', groupedNumber(analytics.guestVisitorsToday), 'تعداد بازدیدکنندگان یکتای امروز که در طول فعالیت امروز خود به حساب کاربری وارد نشده‌اند.'],
    ['authenticated-users', 'کاربران واردشده امروز', groupedNumber(analytics.authenticatedUsersToday), 'تعداد کاربران یکتایی که امروز با حساب کاربری خود حداقل یک فعالیت در کفگیر داشته‌اند.'],
    ['new-users', 'کاربران جدید', groupedNumber(analytics.newUsersToday), 'تعداد کاربران واردشده امروز که حساب کاربری آن‌ها نیز امروز ایجاد شده است.'],
    ['returning-users', 'کاربران بازگشتی', groupedNumber(analytics.returningUsersToday), 'تعداد کاربران واردشده امروز که حساب کاربری آن‌ها قبل از امروز ایجاد شده است.'],
    ['sessions', 'نشست‌های امروز', groupedNumber(analytics.sessionsToday), 'تعداد نشست‌های کاربری که امروز شروع شده‌اند. اگر کاربر بیش از ۳۰ دقیقه فعالیت نداشته باشد، فعالیت بعدی یک نشست جدید محسوب می‌شود.'],
    ['conversion', 'نرخ تبدیل به سفارش', `${formatNumber(analytics.conversionRate, 1)}٪`, 'درصد بازدیدکنندگان یکتای امروز که حداقل یک سفارش ثبت کرده‌اند. تعداد سفارش‌ها ملاک نیست؛ تعداد بازدیدکنندگان سفارش‌دهنده محاسبه می‌شود.'],
  ] : []
  return <PageFrame
    title="داشبورد امروز"
    actions={<>
      {data && <div className="panel menu-state menu-state-inline"><strong>سفارش‌گیری امروز</strong><StatusPill active={data.isTodayMenuOpen} /></div>}
      <button onClick={() => { void load(); void loadAnalytics() }}>تازه‌سازی</button>
    </>}
  >
    <Message error={error} />
    <div className="metric-grid">{cards.map(([label, value]) =>
      <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    {operations && <><div className="metric-grid">
      {[
        ['هزینه امروز', money(operations.todayExpense)],
        ['پرداخت‌های تأییدنشده', plainNumber(operations.unverifiedPayments)],
        ['موجودی‌های کم', plainNumber(operations.lowStockCount)],
        ['خریدهای پرداخت‌نشده', plainNumber(operations.unpaidPurchases)],
        ['سفارش‌های بدون دستور پخت', plainNumber(operations.missingRecipeOrders)],
        ['ضایعات امروز', money(operations.todayWasteCost)],
      ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div></>}
    <section className="customer-analytics-section" aria-labelledby="customer-analytics-title">
      <div className="customer-analytics-heading">
        <div><h2 id="customer-analytics-title">آمار کاربران امروز</h2><p>فعالیت مشتریان و مهمان‌های وب و مینی‌اپ</p></div>
        {analyticsError && <span role="status">{analyticsError}</span>}
      </div>
      {analytics ? <div className="metric-grid analytics-metric-grid">{analyticsCards.map(([id, label, value, help]) => <article className={`metric analytics-metric ${id === 'online-now' ? 'online-metric' : ''}`} key={id}>
        <div className="analytics-metric-title"><span>{label}</span><MetricHelp id={id} text={help} /></div>
        <strong>{value}</strong>
      </article>)}</div> : analyticsLoaded
        ? <div className="message error" role="status">آمار کاربران فعلاً در دسترس نیست.</div>
        : <div className="analytics-skeleton" aria-label="در حال دریافت آمار کاربران">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>}
    </section>
  </PageFrame>
}

function MetricHelp({ id, text }: { id: string; text: string }) {
  const tooltipId = `analytics-tooltip-${id}`
  return <span className="metric-help">
    <button type="button" aria-label="روش محاسبه" aria-describedby={tooltipId}>؟</button>
    <span id={tooltipId} className="metric-help-tooltip" role="tooltip">{text}</span>
  </span>
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'open' : 'closed'}`}>{active ? 'فعال' : 'غیرفعال'}</span>
}

function Pagination({ totalItems, pageSize, currentPage, onChange }: {
  totalItems: number
  pageSize: number
  currentPage: number
  onChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  if (totalItems <= pageSize) return null
  return <nav className="pagination" aria-label="صفحه‌بندی">
    <button type="button" disabled={safePage === 1} onClick={() => onChange(safePage - 1)}>صفحه قبل</button>
    <span>صفحه {plainNumber(safePage)} از {plainNumber(pageCount)}</span>
    <button type="button" disabled={safePage === pageCount} onClick={() => onChange(safePage + 1)}>صفحه بعد</button>
  </nav>
}

const statusActions = (status: OrderStatus): Array<{ status: OrderStatus; label: string; className: string }> => {
  switch (status) {
    case OrderStatus.PendingConfirmation:
      return [
        { status: OrderStatus.Confirmed, label: 'تایید سفارش', className: 'primary' },
        { status: OrderStatus.Cancelled, label: 'لغو سفارش', className: 'danger' },
      ]
    case OrderStatus.Confirmed:
      return [
        { status: OrderStatus.Preparing, label: 'شروع آماده‌سازی', className: 'secondary' },
        { status: OrderStatus.Delivered, label: 'تحویل سفارش', className: 'primary' },
        { status: OrderStatus.Cancelled, label: 'لغو سفارش', className: 'danger' },
      ]
    case OrderStatus.Preparing:
      return [
        { status: OrderStatus.Ready, label: 'آماده تحویل', className: 'secondary' },
        { status: OrderStatus.Cancelled, label: 'لغو سفارش', className: 'danger' },
      ]
    case OrderStatus.Ready:
      return [
        { status: OrderStatus.Delivered, label: 'تحویل سفارش', className: 'primary' },
        { status: OrderStatus.Cancelled, label: 'لغو سفارش', className: 'danger' },
      ]
    default:
      return []
  }
}

function OrderStatusActions({ status, busy, onChange }: {
  status: OrderStatus
  busy: boolean
  onChange: (status: OrderStatus) => void
}) {
  return <div className="action-row order-status-actions">
    {statusActions(status).map((action) =>
      <button type="button" key={action.status} className={action.className} disabled={busy}
        onClick={() => onChange(action.status)}>
        {busy ? 'در حال ثبت…' : action.label}
      </button>)}
  </div>
}

function OrderDetails({ order }: { order: OrderDto }) {
  const [showInvoice, setShowInvoice] = useState(false)
  return <div className="order-detail">
    <div className="order-detail-heading">
      <div>
        <span className="eyebrow">شماره سفارش</span>
        <strong dir="ltr">{order.orderNumber}</strong>
      </div>
      <div className="order-detail-heading-actions">
        <Status value={order.status} />
        <button type="button" className="secondary-outline" onClick={() => setShowInvoice(true)}>مشاهده و چاپ فاکتور</button>
      </div>
    </div>

    <div className="order-info-grid">
      <section className="detail-section">
        <h3>اطلاعات مشتری</h3>
        <dl>
          <div><dt>نام مشتری</dt><dd>{order.customerFullName}</dd></div>
          <div><dt>شماره تماس</dt><dd dir="ltr">{order.customerPhoneNumber}</dd></div>
          <div><dt>آدرس</dt><dd>{order.addressLine || 'تحویل حضوری'}</dd></div>
        </dl>
      </section>
      <section className="detail-section">
        <h3>اطلاعات سفارش</h3>
        <dl>
          <div><dt>زمان ثبت</dt><dd>{dateTime(order.createdAt)}</dd></div>
          <div><dt>روش دریافت</dt><dd>{deliveryMethodLabel[order.deliveryMethod]}</dd></div>
          <div><dt>زمان تحویل</dt><dd>{deliveryWindowLabel(order)}</dd></div>
          <div><dt>روش فروش</dt><dd>{paymentMethodLabel[order.paymentMethod]}</dd></div>
          <div><dt>جمع اقلام</dt><dd>{money(order.subtotalAmount)}</dd></div>
          <div><dt>هزینه ارسال</dt><dd>{money(order.deliveryFee)}</dd></div>
          <div className="detail-total"><dt>مبلغ کل</dt><dd>{money(order.totalAmount)}</dd></div>
        </dl>
      </section>
      <section className="detail-section">
        <h3>یادداشت‌ها</h3>
        <dl>
          <div><dt>یادداشت مشتری</dt><dd>{order.customerNote || '—'}</dd></div>
          <div><dt>یادداشت ادمین</dt><dd>{order.adminNote || '—'}</dd></div>
        </dl>
      </section>
    </div>

    <section className="order-table-section">
      <h3>اقلام سفارش</h3>
      <div className="table-wrap detail-table"><table><thead><tr><th>غذا</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead>
        <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.foodName}</td><td>{plainNumber(item.quantity)}</td><td>{money(item.unitPrice)}</td><td>{money(item.totalPrice)}</td></tr>)}</tbody></table></div>
    </section>

    <section className="order-table-section">
      <h3>تاریخچه وضعیت</h3>
      <div className="table-wrap detail-table"><table><thead><tr><th>از</th><th>به</th><th>زمان</th><th>توضیح</th></tr></thead>
        <tbody>{order.statusHistories.map((item, index) => <tr key={`${item.changedAt}-${index}`}>
          <td><Status value={item.fromStatus} /></td><td><Status value={item.toStatus} /></td>
          <td>{dateTime(item.changedAt)}</td><td>{item.note || '—'}</td>
        </tr>)}</tbody></table></div>
    </section>
    {showInvoice && <InvoiceDialog order={order} onClose={() => setShowInvoice(false)} />}
  </div>
}

function OrdersPage() {
  const pageSize = 12
  const [orders, setOrders] = useState<OrderSummaryDto[]>([])
  const [selected, setSelected] = useState<OrderDto | null>(null)
  const [status, setStatus] = useState<string>('')
  const [orderNumber, setOrderNumber] = useState('')
  const [auto, setAuto] = useState(true)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const selectedId = selected?.id
  const load = useCallback(async (showBusy = true) => {
    if (showBusy) setBusy(true)
    try {
      const orderRequest = adminApi.orders({
        date: today(),
        status: status ? Number(status) as OrderStatus : undefined,
        orderNumber: orderNumber.trim() || undefined,
      })
      const [rows, refreshedDetails] = await Promise.all([
        orderRequest,
        selectedId ? adminApi.order(selectedId).catch(() => null) : Promise.resolve(null),
      ])
      setOrders(rows)
      if (selectedId) setSelected(refreshedDetails)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (showBusy) setBusy(false)
    }
  }, [orderNumber, selectedId, status])
  useEffect(() => { setPage(1); void load() }, [status])
  useEffect(() => {
    if (!auto) return
    const timer = window.setInterval(() => void load(false), 10_000)
    return () => window.clearInterval(timer)
  }, [auto, load])
  const search = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setMessage(null)
    void load()
  }
  const open = async (id: number) => {
    setBusy(true)
    setError(null)
    try { setSelected(await adminApi.order(id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const changeStatus = async (newStatus: OrderStatus) => {
    if (!selected) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await adminApi.updateOrderStatus(selected.id, { newStatus })
      const [rows, refreshed] = await Promise.all([
        adminApi.orders({
          date: today(),
          status: status ? Number(status) as OrderStatus : undefined,
          orderNumber: orderNumber.trim() || undefined,
        }),
        adminApi.order(selected.id),
      ])
      setOrders(rows)
      setSelected(refreshed)
      setMessage('وضعیت سفارش با موفقیت به‌روزرسانی شد.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleOrders = orders.slice((safePage - 1) * pageSize, safePage * pageSize)
  return <PageFrame title="سفارش‌ها" actions={<>
    <label className="switch"><input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />تازه‌سازی خودکار</label>
  </>}>
    <Message error={error}>{message || (!error && !busy && orders.length === 0 ? 'سفارشی برای این فیلترها پیدا نشد.' : null)}</Message>
    <div className="orders-workspace">
      <aside className="panel orders-detail-pane">
        <div className="orders-detail-actions">
          {selected
            ? <OrderStatusActions status={selected.status} busy={busy} onChange={(next) => void changeStatus(next)} />
            : <div className="order-status-actions"><button disabled>تایید</button><button disabled>تحویل</button><button disabled>لغو</button></div>}
        </div>
        <h2>جزئیات سفارش</h2>
        {selected
          ? <OrderDetails order={selected} />
          : <div className="orders-empty-detail">برای مشاهده اطلاعات، یک سفارش را انتخاب کنید.</div>}
      </aside>
      <section className="orders-main">
        <form className="toolbar order-filters" onSubmit={search}>
          <label>وضعیت<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">همه وضعیت‌ها</option>
            {Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>شماره سفارش<input dir="ltr" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} /></label>
          <button className="primary" disabled={busy}>{busy ? 'در حال دریافت…' : 'جستجو'}</button>
        </form>
        <div className="panel table-panel orders-table-panel">
          <div className="table-summary"><span>{plainNumber(orders.length)} سفارش</span>{busy && <span>در حال دریافت…</span>}</div>
          <div className="table-wrap">
            <OrderTable orders={visibleOrders} rowOffset={(safePage - 1) * pageSize} selectedId={selected?.id} onOpen={(id) => void open(id)} />
          </div>
          <Pagination totalItems={orders.length} pageSize={pageSize} currentPage={safePage} onChange={setPage} />
        </div>
      </section>
    </div>
  </PageFrame>
}

function OrderTable({ orders, onOpen, rowOffset = 0, selectedId }: {
  orders: OrderSummaryDto[]
  onOpen: (id: number) => void
  rowOffset?: number
  selectedId?: number
}) {
  return <table><thead><tr><th>#</th><th>شماره سفارش</th><th>مشتری</th><th>زمان و تاریخ</th><th>وضعیت</th><th>مبلغ</th><th /></tr></thead>
    <tbody>{orders.map((order, index) => <tr key={order.id} className={order.id === selectedId ? 'selected-row' : undefined} onClick={() => onOpen(order.id)} onDoubleClick={() => onOpen(order.id)}>
      <td>{plainNumber(rowOffset + index + 1)}</td><td dir="ltr">{order.orderNumber}</td><td>{order.customerFullName}</td>
      <td>{dateTime(order.createdAt)}</td><td><Status value={order.status} /></td><td>{money(order.totalAmount)}</td>
      <td><button type="button" className="secondary-outline" onClick={(event) => { event.stopPropagation(); onOpen(order.id) }}>نمایش</button></td>
    </tr>)}</tbody></table>
}

const emptyCategory: FoodCategoryWriteRequest = { title: '', slug: '', icon: null, displayOrder: 0, isActive: true }
const tagGroupLabels: Record<FoodTagWriteRequest['group'], string> = {
  status: 'وضعیت', protein: 'پروتئین', diet: 'رژیم', taste: 'طعم',
  serving: 'سرو', service: 'خدمت', style: 'سبک', marketing: 'بازاریابی',
}
const emptyTag: FoodTagWriteRequest = {
  title: '', slug: '', icon: null, group: 'status', displayOrder: 0,
  isActive: true, isCustomerVisible: true,
}

function CategoriesPage() {
  const [rows, setRows] = useState<FoodCategoryDto[]>([])
  const [form, setForm] = useState<FoodCategoryWriteRequest>(emptyCategory)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = async () => setRows(await adminApi.foodCategories())
  useEffect(() => { void load().catch((reason) => setError(String(reason))) }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      if (editId) await adminApi.updateFoodCategory(editId, form)
      else await adminApi.createFoodCategory(form)
      setForm(emptyCategory); setEditId(null); setError(null); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const edit = (row: FoodCategoryDto) => {
    setEditId(row.id)
    setForm({ title: row.title, slug: row.slug, icon: row.icon, displayOrder: row.displayOrder, isActive: row.isActive })
  }
  return <PageFrame title="دسته‌بندی غذاها" actions={<button onClick={() => { setEditId(null); setForm(emptyCategory) }}>دسته جدید</button>}>
    <Message error={error} />
    <form className="panel form-grid catalog-form" onSubmit={save}>
      <label>عنوان<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>عنوان انگلیسی<input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} required /></label>
      <label>آیکن<input value={form.icon ?? ''} onChange={(event) => setForm({ ...form, icon: event.target.value || null })} /></label>
      <label>ترتیب<input type="number" min="0" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      <button className="primary">{editId ? 'ذخیره' : 'افزودن'}</button>
    </form>
    <div className="panel table-wrap"><table><thead><tr><th>ترتیب</th><th>آیکن</th><th>عنوان</th><th>عنوان انگلیسی</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{plainNumber(row.displayOrder)}</td><td>{row.icon}</td><td>{row.title}</td><td dir="ltr">{row.slug}</td><td><StatusPill active={row.isActive} /></td><td><button onClick={() => edit(row)}>ویرایش</button></td></tr>)}</tbody></table></div>
  </PageFrame>
}

function TagsPage() {
  const [rows, setRows] = useState<FoodTagDto[]>([])
  const [form, setForm] = useState<FoodTagWriteRequest>(emptyTag)
  const [editId, setEditId] = useState<number | null>(null)
  const [groupFilter, setGroupFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = async () => setRows(await adminApi.foodTags())
  useEffect(() => { void load().catch((reason) => setError(String(reason))) }, [])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    try {
      if (editId) await adminApi.updateFoodTag(editId, form)
      else await adminApi.createFoodTag(form)
      setForm(emptyTag); setEditId(null); setError(null); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const edit = (row: FoodTagDto) => {
    setEditId(row.id)
    setForm({
      title: row.title, slug: row.slug, icon: row.icon, group: row.group,
      displayOrder: row.displayOrder, isActive: row.isActive,
      isCustomerVisible: row.isCustomerVisible,
    })
  }
  const visible = groupFilter ? rows.filter((row) => row.group === groupFilter) : rows
  return <PageFrame title="برچسب‌های غذا" actions={<button onClick={() => { setEditId(null); setForm(emptyTag) }}>برچسب جدید</button>}>
    <Message error={error} />
    <form className="panel form-grid tag-form" onSubmit={save}>
      <label>عنوان<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>عنوان انگلیسی<input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} required /></label>
      <label>گروه<select value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value as FoodTagWriteRequest['group'] })}>
        {Object.entries(tagGroupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>آیکن<input value={form.icon ?? ''} onChange={(event) => setForm({ ...form, icon: event.target.value || null })} /></label>
      <label>ترتیب<input type="number" min="0" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      <label className="switch"><input type="checkbox" checked={form.isCustomerVisible} onChange={(event) => setForm({ ...form, isCustomerVisible: event.target.checked })} />نمایش به مشتری</label>
      <button className="primary">{editId ? 'ذخیره' : 'افزودن'}</button>
    </form>
    <div className="toolbar"><label>گروه<select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">همه گروه‌ها</option>
      {Object.entries(tagGroupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="panel table-wrap"><table><thead><tr><th>عنوان</th><th>گروه</th><th>عنوان انگلیسی</th><th>نمایش مشتری</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{visible.map((row) => <tr key={row.id}><td>{row.icon} {row.title}</td><td>{tagGroupLabels[row.group]}</td><td dir="ltr">{row.slug}</td><td>{row.isCustomerVisible ? 'بله' : 'خیر'}</td><td><StatusPill active={row.isActive} /></td><td><button onClick={() => edit(row)}>ویرایش</button></td></tr>)}</tbody></table></div>
  </PageFrame>
}

const emptyFood = (categoryId = 0): FoodWriteRequest => ({
  name: '', slug: '', description: null, fullDescription: null, ingredients: null,
  portionDescription: null, allergyInformation: null, preparationTimeMinutes: null,
  categoryId, tagIds: [], primaryBadgeTagId: null, images: [],
  defaultPrice: 0, imageUrl: null, allowsPersianRice: false, isPersianRice: false, isActive: true,
})

type PendingPhoto = { file: File; preview: string }

const foodWriteFromDto = (food: FoodDto, overrides: Partial<FoodWriteRequest> = {}): FoodWriteRequest => {
  const images = overrides.images ?? food.images
  return {
    name: food.name,
    slug: food.slug,
    description: food.description,
    fullDescription: food.fullDescription,
    ingredients: food.ingredients,
    portionDescription: food.portionDescription,
    allergyInformation: food.allergyInformation,
    preparationTimeMinutes: food.preparationTimeMinutes,
    categoryId: food.categoryId,
    tagIds: food.tagIds,
    primaryBadgeTagId: food.primaryBadgeTagId,
    images,
    defaultPrice: food.defaultPrice,
    imageUrl: images.find((image) => image.isPrimary)?.imageUrl ?? images[0]?.imageUrl ?? food.imageUrl ?? null,
    allowsPersianRice: food.allowsPersianRice,
    isPersianRice: food.isPersianRice,
    isActive: food.isActive,
    ...overrides,
  }
}

function FoodsPage({ onCreate, onEdit, onPhotos, onTags }: {
  onCreate: () => void
  onEdit: (foodId: number) => void
  onPhotos: (foodId: number) => void
  onTags: (foodId: number) => void
}) {
  const [foods, setFoods] = useState<FoodDto[]>([])
  const [categories, setCategories] = useState<FoodCategoryDto[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    try {
      const [foodRows, categoryRows] = await Promise.all([adminApi.foods(), adminApi.foodCategories()])
      setFoods(foodRows)
      setCategories(categoryRows)
      setError(null)
    } catch (reason) { setError(String(reason)) }
  }
  useEffect(() => { void load() }, [])
  const visible = foods.filter((food) => food.name.includes(search))
  return <PageFrame title="غذاها" actions={<button className="primary" onClick={onCreate}>غذای جدید</button>}>
    <Message error={error} />
    <div className="toolbar"><label>جستجوی نام غذا<input value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <div className="panel table-wrap"><table><thead><tr><th>نام</th><th>دسته</th><th>توضیحات</th><th>عکس</th><th>نقش برنج</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{visible.map((food) => {
        const hasPhoto = food.images.length > 0 || Boolean(food.imageUrl)
        const riceRole = food.isPersianRice
          ? 'خودِ برنج ایرانی'
          : food.allowsPersianRice ? 'قابل ارتقا به برنج ایرانی' : '—'
        return <tr key={food.id}><td>{food.name}</td><td>{categories.find((category) => category.id === food.categoryId)?.title}</td><td>{food.description}</td><td><span className={`badge ${hasPhoto ? 'open' : 'closed'}`}>{hasPhoto ? 'دارد' : 'ندارد'}</span></td><td><span className={`badge ${food.isPersianRice || food.allowsPersianRice ? 'open' : 'closed'}`}>{riceRole}</span></td><td><StatusPill active={food.isActive} /></td><td className="actions"><button onClick={() => onEdit(food.id)}>ویرایش</button><button onClick={() => onTags(food.id)}>تگ‌ها</button><button onClick={() => onPhotos(food.id)}>عکس‌ها</button></td></tr>
      })}</tbody></table></div>
  </PageFrame>
}

function FoodEditorPage({
  foodId,
  onBack,
  onSaved,
  onPhotos,
  onTags,
}: {
  foodId: number | null
  onBack: () => void
  onSaved: () => void
  onPhotos: (foodId: number) => void
  onTags: (foodId: number) => void
}) {
  const [categories, setCategories] = useState<FoodCategoryDto[]>([])
  const [existingFoods, setExistingFoods] = useState<FoodDto[]>([])
  const [form, setForm] = useState<FoodWriteRequest>(emptyFood())
  const [savedFood, setSavedFood] = useState<FoodDto | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [categoryRows, foodRows] = await Promise.all([
          adminApi.foodCategories(),
          adminApi.foods(),
        ])
        if (cancelled) return
        setCategories(categoryRows)
        setExistingFoods(foodRows)
        if (foodId) {
          const food = foodRows.find((row) => row.id === foodId)
          if (!food) throw new Error('غذا پیدا نشد.')
          setSavedFood(food)
          setForm({
            name: food.name, slug: food.slug, description: food.description,
            fullDescription: food.fullDescription, ingredients: food.ingredients,
            portionDescription: food.portionDescription, allergyInformation: food.allergyInformation,
            preparationTimeMinutes: food.preparationTimeMinutes, categoryId: food.categoryId,
            tagIds: food.tagIds, primaryBadgeTagId: food.primaryBadgeTagId,
            images: [], defaultPrice: food.defaultPrice,
            imageUrl: null, allowsPersianRice: food.allowsPersianRice,
            isPersianRice: food.isPersianRice, isActive: food.isActive,
          })
        } else {
          setSavedFood(null)
          setForm(emptyFood(categoryRows.find((row) => row.isActive)?.id ?? 0))
        }
        setError(null)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [foodId])

  const goBack = () => onBack()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (existingFoods.some((food) => food.id !== foodId && normalizedFoodName(food.name) === normalizedFoodName(form.name))) {
      setError('نام غذا تکراری است.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const savedImages = savedFood?.images ?? []
      const request: FoodWriteRequest = { ...form, images: savedImages }
      request.imageUrl = request.images.find((image) => image.isPrimary)?.imageUrl ?? request.images[0]?.imageUrl ?? null
      if (foodId) await adminApi.updateFood(foodId, request)
      else await adminApi.createFood(request)
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setUploading(false)
    }
  }
  const duplicateName = existingFoods.some((food) => food.id !== foodId && normalizedFoodName(food.name) === normalizedFoodName(form.name))
  const editorFormId = `food-editor-${foodId ?? 'new'}`
  return <PageFrame
    title={foodId ? 'ویرایش غذا' : 'غذای جدید'}
    actions={<><button type="button" onClick={goBack}>بازگشت به غذاها</button>{foodId && <button type="button" onClick={() => onTags(foodId)}>تگ‌ها</button>}{foodId && <button type="button" onClick={() => onPhotos(foodId)}>مدیریت عکس‌ها</button>}</>}
  >
    <Message error={error} />
    {loading ? <div className="panel message">در حال دریافت اطلاعات غذا…</div> :
    <div className="food-editor">
    <form id={editorFormId} className="panel form-grid food-editor-main" onSubmit={save}>
      <div className="food-editor-grid">
        <label>عنوان غذا<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />{duplicateName && <small className="field-error">این نام غذا قبلاً ثبت شده است.</small>}</label>
        <label>عنوان انگلیسی<input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} required /></label>
        <label>دسته‌بندی<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })} required>
          <option value="">انتخاب دسته</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.title}{!category.isActive ? ' (غیرفعال)' : ''}</option>)}</select></label>
        <label className="switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      </div>
      <fieldset className="food-rice-role"><legend>برنج</legend>
        <label className="switch">
          <input type="checkbox" checked={form.allowsPersianRice} disabled={form.isPersianRice}
            onChange={(event) => setForm({ ...form, allowsPersianRice: event.target.checked })} />
          امکان افزودن برنج ایرانی به این غذا
        </label>
        <label className="switch">
          <input type="checkbox" checked={form.isPersianRice} disabled={form.allowsPersianRice}
            onChange={(event) => setForm({ ...form, isPersianRice: event.target.checked })} />
          این غذا خودِ «برنج ایرانی» است
        </label>
        <small className="food-rice-help">
          همه غذاها با برنج خارجی سرو می‌شوند و قیمتشان شامل آن است. با فعال‌کردن گزینه اول، مشتری
          می‌تواند برنج ایرانی را با پرداخت مابه‌التفاوت جایگزین کند. غذای «برنج ایرانی» در فهرست
          غذاهای مشتری دیده نمی‌شود و قیمت و ظرفیتش مثل هر غذای دیگر در منوی امروز تنظیم می‌شود.
        </small>
      </fieldset>
      <label>توضیح کوتاه<textarea maxLength={300} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value || null })} /></label>
      <label>توضیح کامل<textarea value={form.fullDescription ?? ''} onChange={(event) => setForm({ ...form, fullDescription: event.target.value || null })} /></label>
      <div className="food-editor-grid">
        <label>مواد اولیه<textarea value={form.ingredients ?? ''} onChange={(event) => setForm({ ...form, ingredients: event.target.value || null })} /></label>
        <label>مقدار و محتویات هر پرس<textarea value={form.portionDescription ?? ''} onChange={(event) => setForm({ ...form, portionDescription: event.target.value || null })} /></label>
        <label>مواد حساسیت‌زا<textarea value={form.allergyInformation ?? ''} onChange={(event) => setForm({ ...form, allergyInformation: event.target.value || null })} /></label>
      </div>
    </form>
      <section className="customer-food-preview"><h3>پیش‌نمایش اطلاعات مشتری</h3><strong>{form.name || 'عنوان غذا'}</strong><span>{categories.find((category) => category.id === form.categoryId)?.title}</span><p>{form.description || 'توضیح کوتاه غذا'}</p>{form.allergyInformation && <em>حساسیت‌زا: {form.allergyInformation}</em>}</section>
      <div className="food-editor-actions">
        <button type="button" onClick={goBack}>انصراف</button>
        <button form={editorFormId} className="primary" disabled={uploading || duplicateName}>{uploading ? 'در حال بارگذاری…' : foodId ? 'ذخیره تغییرات' : 'افزودن غذا'}</button>
      </div>
    </div>}
  </PageFrame>
}

function FoodTagsPage({ foodId, onBack }: { foodId: number | null; onBack: () => void }) {
  const [food, setFood] = useState<FoodDto | null>(null)
  const [tags, setTags] = useState<FoodTagDto[]>([])
  const [tagIds, setTagIds] = useState<number[]>([])
  const [primaryBadgeTagId, setPrimaryBadgeTagId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!foodId) {
      setError('ابتدا غذا را ذخیره کنید، سپس تگ‌های آن را تنظیم کنید.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [foodRows, tagRows] = await Promise.all([adminApi.foods(), adminApi.foodTags()])
      const found = foodRows.find((row) => row.id === foodId)
      if (!found) throw new Error('غذا پیدا نشد.')
      const activeTags = tagRows.filter((tag) => tag.isActive)
      const activeTagIds = new Set(activeTags.map((tag) => tag.id))
      const assignedActiveTagIds = found.tagIds.filter((tagId) => activeTagIds.has(tagId))
      setFood(found)
      setTags(activeTags)
      setTagIds(assignedActiveTagIds)
      setPrimaryBadgeTagId(found.primaryBadgeTagId && activeTagIds.has(found.primaryBadgeTagId) ? found.primaryBadgeTagId : null)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [foodId])
  useEffect(() => { void load() }, [load])
  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id))
  const toggleTag = (tagId: number, checked: boolean) => {
    const nextTagIds = checked ? [...tagIds, tagId] : tagIds.filter((id) => id !== tagId)
    setTagIds(nextTagIds)
    if (primaryBadgeTagId && !nextTagIds.includes(primaryBadgeTagId)) setPrimaryBadgeTagId(null)
  }
  const saveTags = async (event: FormEvent) => {
    event.preventDefault()
    if (!foodId || !food) return setError('ابتدا غذا را ذخیره کنید، سپس تگ‌های آن را تنظیم کنید.')
    setSaving(true)
    setError(null)
    try {
      await adminApi.updateFood(foodId, foodWriteFromDto(food, { tagIds, primaryBadgeTagId }))
      onBack()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setSaving(false)
    }
  }
  return <PageFrame title={food ? `تگ‌های ${food.name}` : 'تگ‌ها'} actions={<button type="button" onClick={onBack}>بازگشت به غذاها</button>}>
    <Message error={error} />
    {loading ? <div className="panel message">در حال دریافت تگ‌های غذا…</div> :
      <form className="panel form-grid food-tags-editor" onSubmit={saveTags}>
        <div className="detail-title"><h3>فرم مستقل تگ‌ها</h3><span className="eyebrow">{food?.name}</span></div>
        <fieldset className="tag-picker"><legend>تگ‌ها</legend>{tags.map((tag) => <label key={tag.id}>
          <input type="checkbox" checked={tagIds.includes(tag.id)} onChange={(event) => toggleTag(tag.id, event.target.checked)} />{tag.icon} {tag.title}</label>)}</fieldset>
        <label>نشان اصلی کارت<select value={primaryBadgeTagId ?? ''} onChange={(event) => setPrimaryBadgeTagId(event.target.value ? Number(event.target.value) : null)}>
          <option value="">بدون نشان</option>{selectedTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.icon} {tag.title}</option>)}</select></label>
        <div className="food-editor-actions">
          <button type="button" onClick={onBack}>انصراف</button>
          <button className="primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیره تگ‌ها'}</button>
        </div>
      </form>}
  </PageFrame>
}

function FoodPhotosPage({ foodId, onBack }: { foodId: number | null; onBack: () => void }) {
  const [food, setFood] = useState<FoodDto | null>(null)
  const [photoImages, setPhotoImages] = useState<FoodWriteRequest['images']>([])
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const pendingPhotosRef = useRef<PendingPhoto[]>([])
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearPending = () => {
    pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
    pendingPhotosRef.current = []
    setPendingPhotos([])
  }

  const load = useCallback(async () => {
    if (!foodId) {
      setError('ابتدا غذا را ذخیره کنید، سپس عکس آن را بارگذاری کنید.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const found = (await adminApi.foods()).find((row) => row.id === foodId)
      if (!found) throw new Error('غذا پیدا نشد.')
      setFood(found)
      setPhotoImages(found.images)
      const previews = await Promise.all(found.images.map(async (image) => [
        image.imageUrl,
        await adminApi.resolveMediaUrl(image.imageUrl).catch(() => image.imageUrl),
      ] as const))
      setImagePreviews(Object.fromEntries(previews))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [foodId])

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos
  }, [pendingPhotos])

  useEffect(() => () => {
    pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
  }, [])

  useEffect(() => { void load() }, [load])

  const selectPhotos = (files: FileList | null) => {
    if (!files) return
    const selected = [...files]
    if (photoImages.length + pendingPhotos.length + selected.length > 10) return setError('حداکثر 10 تصویر برای هر غذا مجاز است.')
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) return setError('حجم هر تصویر نباید بیشتر از 5 مگابایت باشد.')
    setPendingPhotos((current) => [...current, ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    setError(null)
  }
  const setPrimary = (index: number) => setPhotoImages((images) =>
    images.map((image, imageIndex) => ({ ...image, isPrimary: imageIndex === index })))
  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= photoImages.length) return
    const images = [...photoImages]
    ;[images[index], images[target]] = [images[target]!, images[index]!]
    setPhotoImages(images.map((image, imageIndex) => ({ ...image, displayOrder: imageIndex })))
  }
  const savePhotos = async (event: FormEvent) => {
    event.preventDefault()
    if (!foodId || !food) return setError('ابتدا غذا را ذخیره کنید، سپس عکس آن را بارگذاری کنید.')
    setUploading(true)
    setError(null)
    const uploadedImageUrls: string[] = []
    try {
      const images = [...photoImages]
      for (const photo of pendingPhotos) {
        const uploaded = await adminApi.uploadFoodImage(photo.file)
        uploadedImageUrls.push(uploaded.imageUrl)
        images.push({
          imageUrl: uploaded.imageUrl,
          altText: food.name,
          displayOrder: images.length,
          isPrimary: images.length === 0,
        })
      }
      const normalizedImages = images.map((image, index) => ({
        ...image,
        altText: image.altText || food.name,
        displayOrder: index,
      }))
      await adminApi.updateFood(foodId, foodWriteFromDto(food, { images: normalizedImages }))
      clearPending()
      onBack()
    } catch (reason) {
      await Promise.all(uploadedImageUrls.map((imageUrl) => adminApi.deleteFoodImage(imageUrl).catch(() => undefined)))
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setUploading(false)
    }
  }

  return <PageFrame title={food ? `عکس‌های ${food.name}` : 'عکس‌های غذا'} actions={<button type="button" onClick={onBack}>بازگشت به غذاها</button>}>
    <Message error={error} />
    {loading ? <div className="panel message">در حال دریافت عکس‌های غذا…</div> :
      <form className="panel food-gallery-editor food-photo-page" onSubmit={savePhotos}>
        <div className="detail-title"><h3>فرم مستقل بارگذاری عکس غذا</h3><label className="file-picker"><span>افزودن تصاویر</span><input type="file" multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={uploading || !foodId} onChange={(event) => selectPhotos(event.target.files)} /></label></div>
        <p className="photo-form-hint">این صفحه جدا از فرم افزودن/ویرایش غذاست. تغییرات عکس فقط با دکمه ذخیره عکس‌ها ثبت می‌شود.</p>
        <div className="food-gallery-list">
          {photoImages.map((image, index) => <article key={`${image.imageUrl}-${index}`} className={image.isPrimary ? 'primary-image' : ''}>
            <img src={imagePreviews[image.imageUrl] ?? image.imageUrl} alt={image.altText} />
            <input value={image.altText} aria-label="متن جایگزین" onChange={(event) => setPhotoImages((images) => images.map((value, imageIndex) => imageIndex === index ? { ...value, altText: event.target.value } : value))} />
            <div>
              <button type="button" onClick={() => setPrimary(index)}>{image.isPrimary ? 'عکس اصلی' : 'انتخاب به‌عنوان عکس اصلی'}</button>
              <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>انتقال به قبل</button>
              <button type="button" onClick={() => moveImage(index, 1)} disabled={index === photoImages.length - 1}>انتقال به بعد</button>
              <button type="button" className="danger" onClick={() => setPhotoImages((images) => images.filter((_, imageIndex) => imageIndex !== index))}>حذف</button>
            </div>
          </article>)}
          {pendingPhotos.map((photo, index) => <article key={photo.preview}><img src={photo.preview} alt="تصویر جدید" /><strong>پس از ذخیره بارگذاری می‌شود</strong><button type="button" className="danger" onClick={() => {
            URL.revokeObjectURL(photo.preview)
            setPendingPhotos(pendingPhotos.filter((_, photoIndex) => photoIndex !== index))
          }}>حذف</button></article>)}
        </div>
        <div className="food-photo-submit"><button className="secondary" disabled={uploading || !foodId}>{uploading ? 'در حال بارگذاری…' : 'ذخیره عکس‌ها'}</button></div>
      </form>}
  </PageFrame>
}

function DailyMenuPage() {
  const date = today()
  const [menu, setMenu] = useState<DailyMenuDto | null>(null)
  const [foods, setFoods] = useState<FoodDto[]>([])
  const [foodId, setFoodId] = useState('')
  const [price, setPrice] = useState(0)
  const [discountEnabled, setDiscountEnabled] = useState(false)
  const [discountPrice, setDiscountPrice] = useState(0)
  const [capacity, setCapacity] = useState(1)
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    const [foodRows, menuRow] = await Promise.all([
      adminApi.foods(),
      adminApi.menu(date).catch(() => null),
    ])
    setFoods(foodRows)
    setMenu(menuRow)
  }
  useEffect(() => { void load() }, [])
  const persianRice = menu?.persianRice ?? null
  const selectedFood = foods.find((food) => food.id === Number(foodId))
  const saveItem = async (event: FormEvent) => {
    event.preventDefault()
    if (discountEnabled && (discountPrice <= 0 || discountPrice >= price)) {
      setError('قیمت تخفیف باید بیشتر از صفر و کمتر از قیمت اصلی باشد.')
      return
    }
    try {
      const item = { price, discountPrice: discountEnabled ? discountPrice : null, capacityPortions: capacity, isAvailable: true }
      const updated = editing
        ? await adminApi.updateMenuItem(editing, item)
        : await adminApi.addMenuItem(date, { foodId: Number(foodId), ...item })
      setMenu(updated); setEditing(null); setFoodId(''); setPrice(0); setDiscountEnabled(false); setDiscountPrice(0); setCapacity(1); setError(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const edit = (item: DailyMenuDto['items'][number], startDiscount = false) => {
    const regularPrice = item.originalPrice ?? item.price
    const hasDiscount = item.originalPrice != null
    setEditing(item.id)
    setFoodId(String(item.foodId))
    setPrice(regularPrice)
    setDiscountEnabled(hasDiscount || startDiscount)
    setDiscountPrice(hasDiscount ? item.price : Math.max(1, Math.round((regularPrice * 0.9) / 1_000) * 1_000))
    setCapacity(item.capacityPortions)
    setError(null)
  }
  const discountPercentage = discountEnabled && price > 0 && discountPrice > 0 && discountPrice < price
    ? Math.round((1 - discountPrice / price) * 100)
    : 0
  const toggle = async () => setMenu(await adminApi.menuSettings(date, !(menu?.isOpen ?? false), menu?.note))
  return <PageFrame title="منوی امروز" actions={<button className={menu?.isOpen ? 'secondary' : 'primary'} onClick={() => void toggle()}>
    سفارش‌گیری {menu?.isOpen ? 'باز است' : 'بسته است'}
  </button>}>
    <Message error={error} />
    <form className="panel form-grid menu-form" onSubmit={saveItem}>
      <label>غذا<select value={foodId} disabled={editing !== null} onChange={(event) => setFoodId(event.target.value)} required>
        <option value="">انتخاب غذا</option>{foods.filter((food) => food.isActive).map((food) => <option value={food.id} key={food.id}>{food.name}{food.isPersianRice ? ' (برنج ایرانی)' : ''}</option>)}</select>
        <small>{selectedFood?.isPersianRice ? 'قیمت این ردیف باید مابه‌التفاوت ارتقا به برنج ایرانی باشد، نه قیمت یک پرس کامل برنج.' : selectedFood?.allowsPersianRice ? 'مشتری می‌تواند به این غذا برنج ایرانی اضافه کند؛ «برنج ایرانی» را هم به منوی امروز اضافه کنید.' : ''}</small></label>
      <label>قیمت امروز<input dir="ltr" inputMode="numeric" value={formatMoneyInput(price)} onChange={(event) => setPrice(parseMoneyInput(event.target.value))} /><small className="price-help">{numberToPersianWords(price)}</small></label>
      <label>ظرفیت پرس<input type="number" min="0" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /><small /></label>
      <div className={`menu-discount-control ${discountEnabled ? 'active' : ''}`}>
        <label className="switch"><input type="checkbox" checked={discountEnabled} onChange={(event) => setDiscountEnabled(event.target.checked)} /> تخفیف فوری</label>
        {discountEnabled
          ? <label>قیمت نهایی<input dir="ltr" inputMode="numeric" value={discountPrice ? formatMoneyInput(discountPrice) : ''} onChange={(event) => setDiscountPrice(parseMoneyInput(event.target.value))} /><small>{discountPercentage > 0 ? `${plainNumber(discountPercentage)}٪ تخفیف؛ ${money(price - discountPrice)} صرفه‌جویی` : 'قیمت نهایی باید کمتر از قیمت اصلی باشد'}</small></label>
          : <small>با فعال‌سازی، قیمت تخفیف همان لحظه در وب نمایش داده می‌شود.</small>}
      </div>
      {selectedFood?.allowsPersianRice && !persianRice && <p className="menu-rice-warning">
        «برنج ایرانی» هنوز به منوی امروز اضافه نشده است؛ تا وقتی اضافه نشود گزینه ارتقا به مشتری نمایش داده نمی‌شود.
      </p>}
      <button className="primary">{editing ? 'ذخیره' : 'افزودن به منو'}</button>
    </form>
    <div className="panel table-wrap"><table><thead><tr><th>غذا</th><th>قیمت فروش</th><th>نقش برنج</th><th>تخفیف</th><th>ظرفیت</th><th>فروخته</th><th>باقی‌مانده</th><th /></tr></thead>
      <tbody>{menu?.items.map((item) => <tr key={item.id}><td>{item.foodName}</td><td>{item.originalPrice ? <div className="admin-discount-price"><del>{money(item.originalPrice)}</del><strong>{money(item.price)}</strong></div> : money(item.price)}</td><td>{persianRice?.menuItemId === item.id ? 'برنج ایرانی' : item.allowsPersianRice ? 'قابل ارتقا' : '—'}</td><td>{item.discountPercentage ? <span className="discount-badge">{plainNumber(item.discountPercentage)}٪ تخفیف</span> : <span className="muted-cell">بدون تخفیف</span>}</td><td>{plainNumber(item.capacityPortions)}</td><td>{plainNumber(item.soldPortions)}</td><td>{plainNumber(item.remainingPortions)}</td><td className="actions"><button onClick={() => edit(item)}>ویرایش</button><button className="discount-action" onClick={() => edit(item, true)}>{item.discountPercentage ? 'ویرایش تخفیف' : 'تخفیف'}</button><button className="danger" onClick={() => void adminApi.removeMenuItem(item.id).then(setMenu)}>حذف</button></td></tr>)}</tbody></table></div>
  </PageFrame>
}

function ManualOrderPage() {
  const [menu, setMenu] = useState<DailyMenuDto | null>(null)
  const [cart, setCart] = useState<Array<{ id: number; withPersianRice: boolean; persianRicePrice: number; name: string; price: number; quantity: number; remaining: number }>>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [delivery, setDelivery] = useState(DeliveryMethod.Pickup)
  const [payment, setPayment] = useState(PaymentMethod.CardToCard)
  const [address, setAddress] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [withPersianRice, setWithPersianRice] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void adminApi.menu(today())
      .then((dailyMenu) => {
        setMenu(dailyMenu)
        setError(null)
      })
      .catch((reason) => {
        setMenu(null)
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }, [])
  // Persian rice is hidden from the dish list; it is added as an upgrade on a dish that allows it.
  const persianRice = menu?.persianRice ?? null
  const riceAvailable = Boolean(persianRice?.isAvailable && persianRice.remainingPortions > 0)
  const menuItems = menu?.items.filter((item) => item.isAvailable && item.remainingPortions > 0
    && item.id !== persianRice?.menuItemId) ?? []
  const selectedItem = menuItems.find((item) => item.id === Number(selectedItemId))
  const cartTotal = cart.reduce((sum, item) => sum + (item.price + item.persianRicePrice) * item.quantity, 0)
  const addSelected = () => {
    if (!selectedItem) return
    const withRice = withPersianRice && selectedItem.allowsPersianRice && riceAvailable
    setError(null)
    setCart((current) => {
      const remaining = withRice
        ? Math.min(selectedItem.remainingPortions, persianRice!.remainingPortions)
        : selectedItem.remainingPortions
      const existing = current.find((line) => line.id === selectedItem.id && line.withPersianRice === withRice)
      const nextQuantity = existing ? Math.min(existing.quantity + quantity, existing.remaining) : Math.min(quantity, remaining)
      return existing
        ? current.map((line) => line.id === selectedItem.id && line.withPersianRice === withRice ? { ...line, quantity: nextQuantity } : line)
        : [...current, {
          id: selectedItem.id,
          withPersianRice: withRice,
          persianRicePrice: withRice ? persianRice!.price : 0,
          name: selectedItem.foodName,
          price: selectedItem.price,
          quantity: nextQuantity,
          remaining,
        }]
    })
  }
  const changeLineQuantity = (id: number, withRice: boolean, delta: number) => setCart((current) =>
    current.flatMap((line) => {
      if (line.id !== id || line.withPersianRice !== withRice) return [line]
      const nextQuantity = line.quantity + delta
      if (nextQuantity <= 0) return []
      return [{ ...line, quantity: Math.min(nextQuantity, line.remaining) }]
    }))
  const clearOrder = () => {
    setCart([])
    setFullName('')
    setPhone('')
    setDelivery(DeliveryMethod.Pickup)
    setPayment(PaymentMethod.CardToCard)
    setAddress('')
    setCustomerNote('')
    setSelectedItemId('')
    setWithPersianRice(false)
    setQuantity(1)
    setMessage(null)
    setError(null)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const request: CreateOrderRequest = {
      fullName, phoneNumber: phone, city: 'اندیمشک',
      addressLine: delivery === DeliveryMethod.Delivery ? address : 'تحویل حضوری',
      customerNote: customerNote || null,
      saveAddress: false, paymentMethod: payment, deliveryMethod: delivery,
      items: cart.map((item) => ({ dailyMenuItemId: item.id, withPersianRice: item.withPersianRice, quantity: item.quantity })),
    }
    try {
      const order = await adminApi.createOrder(request)
      clearOrder()
      setMessage(`سفارش ${order.orderNumber} ثبت شد.`)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setMessage(null)
    }
  }
  return <PageFrame title="ثبت سفارش" actions={<span className="eyebrow">ثبت سفارش تلفنی یا حضوری از منوی امروز</span>}>
    <Message error={error}>{message}</Message>
    <form className="manual-order-layout" onSubmit={submit}>
      <section className="panel manual-customer-panel">
        <h2>اطلاعات مشتری</h2>
        <label>نام مشتری<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
        <label>شماره تماس<input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
        <label>روش دریافت<select value={delivery} onChange={(event) => setDelivery(Number(event.target.value) as DeliveryMethod)}>
          <option value={DeliveryMethod.Pickup}>تحویل حضوری</option><option value={DeliveryMethod.Delivery}>ارسال</option>
        </select></label>
        <label>روش پرداخت<select value={payment} onChange={(event) => setPayment(Number(event.target.value) as PaymentMethod)}>
          <option value={PaymentMethod.CardToCard}>کارت به کارت</option><option value={PaymentMethod.Cash}>نقدی</option><option value={PaymentMethod.Pos}>دستگاه پوز</option><option value={PaymentMethod.Online}>آنلاین</option>
        </select></label>
        <label>آدرس<textarea value={address} disabled={delivery === DeliveryMethod.Pickup} onChange={(event) => setAddress(event.target.value)} required={delivery === DeliveryMethod.Delivery} placeholder={delivery === DeliveryMethod.Pickup ? 'برای تحویل حضوری لازم نیست' : ''} /></label>
        <label>یادداشت مشتری<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} /></label>
        <div className="manual-submit-row">
          <button type="button" className="secondary" onClick={clearOrder}>سفارش جدید</button>
          <button className="primary" disabled={cart.length === 0 || !fullName.trim() || !phone.trim()}>ثبت سفارش</button>
        </div>
      </section>
      <section className="manual-order-main">
        <section className="panel manual-add-panel">
          <h2>افزودن غذا از منوی امروز</h2>
          <div className="manual-add-row">
            <label>غذا<select value={selectedItemId} onChange={(event) => { setSelectedItemId(event.target.value); setWithPersianRice(false) }}>
              <option value="">انتخاب غذا</option>
              {menuItems.map((item) => <option key={item.id} value={item.id}>{item.foodName} - {money(item.price)} - باقی‌مانده {plainNumber(item.remainingPortions)}</option>)}
            </select></label>
            {selectedItem?.allowsPersianRice && <label className="switch manual-rice-toggle">
              <input type="checkbox" checked={withPersianRice} disabled={!riceAvailable}
                onChange={(event) => setWithPersianRice(event.target.checked)} />
              {riceAvailable
                ? `با برنج ایرانی (+${money(persianRice!.price)} — ${plainNumber(persianRice!.remainingPortions)} پرس)`
                : 'برنج ایرانی امروز موجود نیست'}
            </label>}
            <label>تعداد<input type="number" min="1" max={selectedItem?.remainingPortions ?? 99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
            <div className="manual-stepper" aria-label="تغییر تعداد">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
              <span>{plainNumber(quantity)}</span>
              <button type="button" className="primary" onClick={() => setQuantity((value) => Math.min(selectedItem?.remainingPortions ?? 99, value + 1))}>+</button>
            </div>
            <button type="button" className="secondary" disabled={!selectedItem} onClick={addSelected}>افزودن</button>
          </div>
        </section>
        <section className="panel manual-items-panel">
          <div className="manual-section-title"><h2>آیتم‌های سفارش</h2><span>{plainNumber(cart.length)} ردیف</span></div>
          <div className="table-wrap manual-cart-table"><table><thead><tr><th>غذا</th><th>قیمت</th><th>تعداد</th><th>جمع</th><th>عملیات</th></tr></thead>
            <tbody>{cart.length > 0 ? cart.map((line) => <tr key={`${line.id}:${line.withPersianRice}`}>
              <td>{line.name}{line.withPersianRice && <small className="rice-line-label">با برنج ایرانی ({money(line.persianRicePrice)}) — ردیف جداگانه در فاکتور</small>}</td><td>{money(line.price + line.persianRicePrice)}</td><td>{plainNumber(line.quantity)}</td><td>{money((line.price + line.persianRicePrice) * line.quantity)}</td>
              <td className="actions"><button type="button" onClick={() => changeLineQuantity(line.id, line.withPersianRice, -1)}>-</button><button type="button" onClick={() => changeLineQuantity(line.id, line.withPersianRice, 1)}>+</button><button type="button" className="danger" onClick={() => setCart((rows) => rows.filter((item) => item.id !== line.id || item.withPersianRice !== line.withPersianRice))}>حذف</button></td>
            </tr>) : <tr><td colSpan={5}>هنوز آیتمی به سفارش اضافه نشده است.</td></tr>}</tbody></table></div>
          <div className="table-summary"><span>{plainNumber(cart.length)} مورد</span><span>صفحه 1 از 1</span></div>
        </section>
        <strong className="manual-total-bar">جمع کل سفارش: {money(cartTotal)}</strong>
      </section>
    </form>
  </PageFrame>
}

function ReportPage() {
  const pageSize = 14
  const [query, setQuery] = useState<OrderReportQuery>({ date: today() })
  const [orders, setOrders] = useState<OrderSummaryDto[]>([])
  const [foods, setFoods] = useState<FoodDto[]>([])
  const [details, setDetails] = useState<OrderDto | null>(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void adminApi.foods()
      .then(setFoods)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [])
  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    setPage(1)
    try {
      setOrders(await adminApi.orders(query))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { void search() }, [])
  const clearFilters = () => {
    setQuery({ date: today() })
    setPage(1)
    setError(null)
  }
  const openDetails = async (id: number) => {
    setBusy(true)
    setError(null)
    try { setDetails(await adminApi.order(id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  if (details) return <PageFrame title="جزئیات سفارش" actions={<button onClick={() => setDetails(null)}>بازگشت به گزارش</button>}>
    <div className="panel order-detail-panel"><OrderDetails order={details} /></div>
  </PageFrame>
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleOrders = orders.slice((safePage - 1) * pageSize, safePage * pageSize)
  return <PageFrame title="گزارش کل" actions={<span className="result-summary">{plainNumber(orders.length)} سفارش</span>}>
    <form className="toolbar report-filters" onSubmit={search}>
      <label>تاریخ<PersianDatePicker value={query.date} onChange={(date) => setQuery({ ...query, date })} /></label>
      <label>وضعیت<select value={query.status ?? ''} onChange={(event) => setQuery({ ...query, status: event.target.value ? Number(event.target.value) as OrderStatus : undefined })}><option value="">همه وضعیت‌ها</option>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>شماره سفارش<input value={query.orderNumber ?? ''} onChange={(event) => setQuery({ ...query, orderNumber: event.target.value })} /></label>
      <label>نام مشتری<input value={query.customerName ?? ''} onChange={(event) => setQuery({ ...query, customerName: event.target.value })} /></label>
      <label>شماره تماس<input dir="ltr" value={query.phoneNumber ?? ''} onChange={(event) => setQuery({ ...query, phoneNumber: event.target.value })} /></label>
      <label>نوع دریافت<select value={query.deliveryMethod ?? ''} onChange={(event) => setQuery({ ...query, deliveryMethod: event.target.value ? Number(event.target.value) as DeliveryMethod : undefined })}><option value="">همه روش‌ها</option><option value={DeliveryMethod.Pickup}>حضوری</option><option value={DeliveryMethod.Delivery}>ارسال</option></select></label>
      <label>نوع فروش<select value={query.paymentMethod ?? ''} onChange={(event) => setQuery({ ...query, paymentMethod: event.target.value ? Number(event.target.value) as PaymentMethod : undefined })}><option value="">همه روش‌ها</option><option value={PaymentMethod.Cash}>نقدی</option><option value={PaymentMethod.Pos}>دستگاه پوز</option><option value={PaymentMethod.CardToCard}>کارت‌به‌کارت</option><option value={PaymentMethod.Online}>آنلاین</option></select></label>
      <label>غذا<select value={query.foodName ?? ''} onChange={(event) => setQuery({ ...query, foodName: event.target.value || undefined })}><option value="">همه غذاها</option>{foods.map((food) => <option value={food.name} key={food.id}>{food.name}</option>)}</select></label>
      <div className="filter-actions">
        <button className="primary" disabled={busy}>{busy ? 'در حال دریافت…' : 'جستجو'}</button>
        <button type="button" onClick={clearFilters} disabled={busy}>پاک کردن</button>
      </div>
    </form>
    <Message error={error}>{!error && !busy && orders.length === 0 ? 'موردی برای این فیلترها پیدا نشد.' : null}</Message>
    <div className="panel table-panel report-table-panel">
      <div className="table-summary"><span>{plainNumber(orders.length)} سفارش</span>{busy && <span>در حال دریافت گزارش…</span>}</div>
      <div className="table-wrap">
        <ReportOrderTable orders={visibleOrders} rowOffset={(safePage - 1) * pageSize} onOpen={(id) => void openDetails(id)} />
      </div>
      <Pagination totalItems={orders.length} pageSize={pageSize} currentPage={safePage} onChange={setPage} />
    </div>
  </PageFrame>
}

function ReportOrderTable({ orders, onOpen, rowOffset }: {
  orders: OrderSummaryDto[]
  onOpen: (id: number) => void
  rowOffset: number
}) {
  return <table className="report-table"><thead><tr>
    <th>#</th><th>شماره سفارش</th><th>نام مشتری</th><th>شماره تماس</th><th>وضعیت</th>
    <th>نوع دریافت</th><th>زمان تحویل</th><th>نوع فروش</th><th>غذاها</th><th>تعداد</th><th>مبلغ</th><th>زمان و تاریخ</th><th>جزئیات</th>
  </tr></thead><tbody>{orders.map((order, index) => <tr key={order.id} onDoubleClick={() => onOpen(order.id)}>
    <td>{plainNumber(rowOffset + index + 1)}</td>
    <td dir="ltr">{order.orderNumber}</td>
    <td>{order.customerFullName}</td>
    <td dir="ltr">{order.customerPhoneNumber}</td>
    <td><Status value={order.status} /></td>
    <td>{deliveryMethodLabel[order.deliveryMethod]}</td>
    <td>{paymentMethodLabel[order.paymentMethod]}</td>
    <td className="food-summary">{order.foodSummary || '—'}</td>
    <td>{plainNumber(order.totalQuantity)}</td>
    <td>{money(order.totalAmount)}</td>
    <td>{dateTime(order.createdAt)}</td>
    <td><button type="button" className="secondary-outline" onClick={() => onOpen(order.id)}>نمایش</button></td>
  </tr>)}</tbody></table>
}

export function App() {
  const [user, setUser] = useState<string | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [expandedGroup, setExpandedGroup] = useState<NavigationGroupId | null>(
    navigationGroupForPage('dashboard'),
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [foodEditorId, setFoodEditorId] = useState<number | null>(null)
  const [foodPhotoId, setFoodPhotoId] = useState<number | null>(null)
  const [foodTagsId, setFoodTagsId] = useState<number | null>(null)
  useEffect(() => {
    const pageGroup = navigationGroupForPage(page)
    if (pageGroup) setExpandedGroup(pageGroup)
  }, [page])
  if (!user) return <Login onLogin={setUser} />
  const openFoodEditor = (foodId: number | null) => {
    setFoodEditorId(foodId)
    setPage('food-editor')
  }
  const openFoodPhotos = (foodId: number) => {
    setFoodPhotoId(foodId)
    setPage('food-photos')
  }
  const openFoodTags = (foodId: number) => {
    setFoodTagsId(foodId)
    setPage('food-tags')
  }
  const closeFoodEditor = () => {
    setFoodEditorId(null)
    setPage('foods')
  }
  const closeFoodPhotos = () => {
    setFoodPhotoId(null)
    setPage('foods')
  }
  const closeFoodTags = () => {
    setFoodTagsId(null)
    setPage('foods')
  }
  const pages: Record<Page, ReactNode> = {
    dashboard: <DashboardPage />,
    'delivery-slots': <DeliverySlotsPage />,
    'delivery-days': <DeliveryDaysPage />,
    orders: <OrdersPage />,
    manual: <ManualOrderPage />,
    foods: <FoodsPage onCreate={() => openFoodEditor(null)} onEdit={openFoodEditor} onPhotos={openFoodPhotos} onTags={openFoodTags} />,
    'food-editor': <FoodEditorPage foodId={foodEditorId} onBack={closeFoodEditor} onSaved={closeFoodEditor} onPhotos={openFoodPhotos} onTags={openFoodTags} />,
    'food-photos': <FoodPhotosPage foodId={foodPhotoId} onBack={closeFoodPhotos} />,
    'food-tags': <FoodTagsPage foodId={foodTagsId} onBack={closeFoodTags} />,
    categories: <CategoriesPage />,
    tags: <TagsPage />,
    menu: <DailyMenuPage />,
    report: <ReportPage />,
    ingredients: <IngredientsPage />,
    inventory: <InventoryPage />,
    purchases: <PurchasesPage />,
    suppliers: <SuppliersPage />,
    recipes: <RecipesPage />,
    finance: <FinancePage />,
    shopping: <ShoppingPage />,
    payments: <PaymentsPage />,
    'v15-reports': <V15ReportsPage />,
    logs: <LogsPage />,
    'social-dashboard': <SocialDashboardPage />,
    'social-channels': <SocialChannelsPage />,
    'social-publish': <SocialComposerPage />,
    'social-templates': <SocialTemplatesPage />,
    'social-rules': <SocialRulesPage />,
    'social-suggestions': <SocialSuggestionsPage />,
    'social-history': <SocialHistoryPage />,
  }
  return <div className={`admin-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <ToastViewport />
    <aside aria-label="نوار کناری مدیریت">
      <button
        type="button"
        className="sidebar-collapse-toggle"
        aria-label={sidebarCollapsed ? 'باز کردن منوی کناری' : 'بستن منوی کناری'}
        aria-expanded={!sidebarCollapsed}
        onClick={() => setSidebarCollapsed((current) => !current)}
      >
        <span aria-hidden="true" />
      </button>
      <Logo />
      <nav className="admin-navigation" aria-label="منوی اصلی مدیریت">
        <button
          type="button"
          className={`nav-dashboard ${page === 'dashboard' ? 'active' : ''}`}
          aria-current={page === 'dashboard' ? 'page' : undefined}
          onClick={() => {
            setPage('dashboard')
            setExpandedGroup(null)
          }}
        >
          داشبورد
        </button>
        {navigationGroups.map((group) => {
          const isExpanded = expandedGroup === group.id
          const regionId = `navigation-group-${group.id}`
          return <section className="nav-group" key={group.id}>
            <button
              type="button"
              className="nav-group-header"
              aria-expanded={isExpanded}
              aria-controls={regionId}
              onClick={() => setExpandedGroup((currentGroup) =>
                toggleNavigationGroup(currentGroup, group.id))}
            >
              <span>{group.label}</span>
              <span className="nav-chevron" aria-hidden="true" />
            </button>
            <div className="nav-group-items" id={regionId} hidden={!isExpanded}>
              {group.items.map((item) => {
                const isActive = navigationPage(page) === item.page
                return <button
                  type="button"
                  key={item.page}
                  className={`nav-page ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setPage(item.page)}
                >
                  {item.label}
                </button>
              })}
            </div>
          </section>
        })}
      </nav>
      <div className="sidebar-user"><span>{user}</span><button onClick={() => void adminApi.logout().then(() => setUser(null))}>خروج</button></div>
    </aside>
    <main>{pages[page]}</main>
  </div>
}
