import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomerAnalyticsTodayDto } from '@kafgir/contracts'
import { adminApi } from './api'
import { ListState, Message, PageFrame } from './admin-ui'
import { formatNumber } from './number-format'

/**
 * Website and mini-app visitor statistics.
 *
 * These used to sit on the main dashboard, where they competed for attention with the orders the
 * kitchen still had to cook. They are worth reading — just not before lunch — so they moved here,
 * to the end of the sales group, next to the customer report they belong beside.
 *
 * The data and the query are unchanged: this page calls the same `dashboard.analytics` operation and
 * the same service the dashboard used, so moving the UI duplicated nothing.
 */

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

/** Refreshed on a slow loop, because «آنلاین الان» is only meaningful if it is roughly current. */
const refreshIntervalMs = 60_000

type Card = { id: string; label: string; value: string; help: string }

const cardsOf = (analytics: CustomerAnalyticsTodayDto): Card[] => [
  {
    id: 'unique-visitors',
    label: 'بازدیدکنندگان یکتای امروز',
    value: formatNumber(analytics.uniqueVisitorsToday),
    help: 'تعداد بازدیدکنندگان یکتایی که از ابتدای امروز تا اکنون حداقل یک فعالیت در کفگیر داشته‌اند. برای شمارش بازدیدکننده، ورود به حساب کاربری الزامی نیست.',
  },
  {
    id: 'online-now',
    label: 'آنلاین الان',
    value: formatNumber(analytics.onlineNow),
    help: 'تعداد بازدیدکنندگانی که در ۵ دقیقه اخیر در کفگیر فعال بوده‌اند. این عدد تقریبی است و بر اساس آخرین زمان فعالیت کاربر محاسبه می‌شود.',
  },
  {
    id: 'guest-visitors',
    label: 'مهمان‌های امروز',
    value: formatNumber(analytics.guestVisitorsToday),
    help: 'تعداد بازدیدکنندگان یکتای امروز که در طول فعالیت امروز خود به حساب کاربری وارد نشده‌اند.',
  },
  {
    id: 'authenticated-users',
    label: 'کاربران واردشده امروز',
    value: formatNumber(analytics.authenticatedUsersToday),
    help: 'تعداد کاربران یکتایی که امروز با حساب کاربری خود حداقل یک فعالیت در کفگیر داشته‌اند.',
  },
  {
    id: 'new-users',
    label: 'کاربران جدید',
    value: formatNumber(analytics.newUsersToday),
    help: 'تعداد کاربران واردشده امروز که حساب کاربری آن‌ها نیز امروز ایجاد شده است.',
  },
  {
    id: 'returning-users',
    label: 'کاربران بازگشتی',
    value: formatNumber(analytics.returningUsersToday),
    help: 'تعداد کاربران واردشده امروز که حساب کاربری آن‌ها قبل از امروز ایجاد شده است.',
  },
  {
    id: 'sessions',
    label: 'نشست‌های امروز',
    value: formatNumber(analytics.sessionsToday),
    help: 'تعداد نشست‌های کاربری که امروز شروع شده‌اند. اگر کاربر بیش از ۳۰ دقیقه فعالیت نداشته باشد، فعالیت بعدی یک نشست جدید محسوب می‌شود.',
  },
  {
    id: 'conversion',
    label: 'نرخ تبدیل به سفارش',
    value: `${formatNumber(analytics.conversionRate, 1)}٪`,
    help: 'درصد بازدیدکنندگان یکتای امروز که حداقل یک سفارش ثبت کرده‌اند. تعداد سفارش‌ها ملاک نیست؛ تعداد بازدیدکنندگان سفارش‌دهنده محاسبه می‌شود.',
  },
]

function MetricHelp({ id, label, text }: { id: string; label: string; text: string }) {
  const tooltipId = `analytics-tooltip-${id}`
  return <span className="metric-help">
    <button type="button" aria-label={`روش محاسبه ${label}`} aria-describedby={tooltipId}>؟</button>
    <span id={tooltipId} className="metric-help-tooltip" role="tooltip">{text}</span>
  </span>
}

export function SiteAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CustomerAnalyticsTodayDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    // A hidden window does not need fresh counts, and a stacked-up backlog of them on return is
    // worse than none.
    if (inFlight.current || document.visibilityState !== 'visible') return
    inFlight.current = true
    try {
      setAnalytics(await adminApi.customerAnalytics())
      setError(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      inFlight.current = false
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), refreshIntervalMs)
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  return <PageFrame
    title="آمار کاربران سایت"
    description="فعالیت مشتریان و مهمان‌های وب و مینی‌اپ در امروز."
    actions={<button type="button" onClick={() => void load()}>تازه‌سازی</button>}
  >
    <Message error={error} />
    <ListState loading={!loaded && !analytics} error={error} isEmpty={loaded && !analytics}
      emptyText="آمار کاربران فعلاً در دسترس نیست." />
    {analytics && <div className="metric-grid analytics-metric-grid">
      {cardsOf(analytics).map((card) => <article
        className={`metric analytics-metric ${card.id === 'online-now' ? 'online-metric' : ''}`}
        key={card.id}>
        <div className="analytics-metric-title">
          <span>{card.label}</span>
          <MetricHelp id={card.id} label={card.label} text={card.help} />
        </div>
        <strong>{card.value}</strong>
      </article>)}
    </div>}
  </PageFrame>
}
