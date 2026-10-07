import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { MenuPlanDayDto, MenuPlanDto } from '../../types'
import { Icon } from '../../design-system/Icon'
import { FoodImage } from '../../design-system/FoodImage'
import { getMenuPlan } from '../../services/menuApi'
import { formatMoney, formatNumber, formatPersianDay, persianDayParts } from '../../utils/format'

/**
 * The rest of the Persian month.
 *
 * Today leads as a spotlight because it is the only orderable day. The days after it are grouped by
 * Persian week, and a strip of day pills lets the customer jump straight to a date. A day is recognised
 * by its food, so each card leads with the dishes. Days the kitchen has not planned yet stay visible as
 * compact rows — an absent day would read as a day with no food, which is a promise nobody has made.
 */
export function MenuPlanPage({ onBack, onOpenToday }: { onBack: () => void; onOpenToday: () => void }) {
  const [plan, setPlan] = useState<MenuPlanDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [focusDate, setFocusDate] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getMenuPlan()
      .then((result) => { if (active) { setPlan(result); setError(null) } })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت برنامه ماه ممکن نشد.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const view = useMemo(() => (plan ? buildView(plan.days, filter) : null), [plan, filter])

  // Scroll after the render that shows the target, so a jump that first widens the filter still lands.
  useEffect(() => {
    if (!focusDate || !view) return
    const anchor = view.anchorOf.get(focusDate) ?? focusDate
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(dayAnchorId(anchor))?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    const timer = window.setTimeout(() => setFocusDate(null), 1800)
    return () => window.clearTimeout(timer)
  }, [focusDate, view])

  if (isLoading && !plan) return <PlanSkeleton />

  if (!plan || !view) return <main className="menu-plan-page">
    <div className="plan-topbar">
      <button className="checkout-back-link" onClick={onBack}>منوی امروز <Icon name="back" size="sm" /></button>
    </div>
    <div className="plan-failure" role="alert">
      <Icon name="calendar" size="xl" />
      <strong>برنامه ماه در دسترس نیست</strong>
      <p>{error ?? 'دریافت برنامه ماه ممکن نشد.'}</p>
      <button type="button" className="primary-button" onClick={() => setReloadKey((key) => key + 1)}>
        تلاش دوباره <Icon name="refresh" size="sm" />
      </button>
    </div>
  </main>

  const jumpTo = (day: MenuPlanDayDto) => {
    if (filter === 'planned' && !hasMenu(day) && !day.isToday) setFilter('all')
    setFocusDate(day.date)
  }

  return <main className="menu-plan-page">
    <div className="plan-topbar">
      <button className="checkout-back-link" onClick={onBack}>منوی امروز <Icon name="back" size="sm" /></button>
    </div>

    <PlanHero plan={plan} stats={view.stats} />

    {error && <div className="form-error" role="alert">{error}</div>}

    {plan.days.length > 0 && <nav className="plan-strip" aria-label="پرش به روز">
      {plan.days.map((day) => {
        const parts = persianDayParts(day.date)
        const classes = [
          'plan-strip-day',
          day.isToday && 'is-today',
          hasMenu(day) ? 'has-menu' : 'no-menu',
          weekOffset(day.date) === 6 && 'is-friday',
          focusDate === day.date && 'is-active',
        ].filter(Boolean).join(' ')
        return <button key={day.date} type="button" className={classes} onClick={() => jumpTo(day)} aria-label={formatPersianDay(day.date)}>
          <span className="plan-strip-weekday">{parts.weekday.charAt(0)}</span>
          <strong>{parts.day}</strong>
          <span className="plan-strip-dot" aria-hidden="true" />
        </button>
      })}
    </nav>}

    {view.today && <TodaySpotlight day={view.today} focused={focusDate === view.today.date} onOpenToday={onOpenToday} />}

    {plan.days.length > 0 && <div className="plan-toolbar">
      <div className="plan-filter" role="group" aria-label="نمایش روزها">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          همه روزها <span>{formatNumber(view.stats.upcoming)}</span>
        </button>
        <button type="button" aria-pressed={filter === 'planned'} onClick={() => setFilter('planned')}>
          فقط روزهای با منو <span>{formatNumber(view.stats.upcomingWithMenu)}</span>
        </button>
      </div>
      <ul className="plan-legend" aria-label="راهنما">
        <li><span className="plan-legend-dot has-menu" /> منو اعلام شده</li>
        <li><span className="plan-legend-dot no-menu" /> به‌زودی</li>
      </ul>
    </div>}

    {view.weeks.map((week) => <section className="plan-week" key={week.key} aria-labelledby={`plan-week-${week.key}`}>
      <header className="plan-week-head">
        <h2 id={`plan-week-${week.key}`}>{week.title}</h2>
        <span>{week.range}</span>
      </header>
      <div className="plan-week-grid">
        {week.segments.map((segment, index) => segment.kind === 'day'
          ? <PlanDayCard
              key={segment.day.date}
              day={segment.day}
              relative={relativeLabel(segment.day.date, view.todayDate)}
              order={index}
              focused={focusDate != null && (view.anchorOf.get(focusDate) ?? focusDate) === segment.day.date}
            />
          : <PlanGap
              key={segment.days[0].date}
              days={segment.days}
              order={index}
              focused={focusDate != null && view.anchorOf.get(focusDate) === segment.days[0].date}
            />)}
      </div>
    </section>)}

    {view.weeks.length === 0 && !view.today && <div className="plan-failure">
      <Icon name="calendar" size="xl" />
      <strong>{filter === 'planned' ? 'هنوز منوی روزهای پیش‌رو اعلام نشده' : 'روزی از این ماه باقی نمانده'}</strong>
      <p>{filter === 'planned' ? 'به‌محض ثبت منو، غذاهای هر روز همین‌جا نمایش داده می‌شوند.' : 'برنامه ماه بعد به‌زودی اینجا قرار می‌گیرد.'}</p>
    </div>}
    {view.weeks.length === 0 && view.today && filter === 'planned' && <p className="plan-quiet">منوی روزهای بعد از امروز هنوز اعلام نشده است.</p>}
  </main>
}

type Filter = 'all' | 'planned'
type DayRun = [MenuPlanDayDto, ...MenuPlanDayDto[]]
type Segment = { kind: 'day'; day: MenuPlanDayDto } | { kind: 'gap'; days: DayRun }
type Week = { key: string; title: string; range: string; segments: Segment[] }
type Stats = { remaining: number; withMenu: number; upcoming: number; upcomingWithMenu: number; lowestPrice: number | null }

const weekTitles = ['این هفته', 'هفته آینده', 'دو هفته بعد', 'سه هفته بعد', 'چهار هفته بعد', 'پنج هفته بعد']

const dayMs = 86_400_000
const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / dayMs)
/** Days since the Saturday that opens the Persian week; Friday is 6. */
const weekOffset = (isoDate: string) => (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 1) % 7
const hasMenu = (day: MenuPlanDayDto) => day.isPlanned && day.foodCount > 0
const dayAnchorId = (date: string) => `plan-day-${date}`

function relativeLabel(date: string, todayDate: string | null): string | null {
  if (!todayDate) return null
  const distance = dayNumber(date) - dayNumber(todayDate)
  return distance === 1 ? 'فردا' : distance === 2 ? 'پس‌فردا' : null
}

function buildView(days: MenuPlanDayDto[], filter: Filter) {
  const today = days.find((day) => day.isToday) ?? null
  const todayDate = today?.date ?? days[0]?.date ?? null
  const upcoming = days.filter((day) => !day.isToday)
  const prices = days.map((day) => day.lowestPrice).filter((price): price is number => price != null)
  const stats: Stats = {
    remaining: days.length,
    withMenu: days.filter(hasMenu).length,
    upcoming: upcoming.length,
    upcomingWithMenu: upcoming.filter(hasMenu).length,
    lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
  }

  // Unplanned days collapse into one row per run, and every day in the run scrolls to that row.
  const anchorOf = new Map<string, string>()
  const baseWeek = todayDate ? dayNumber(todayDate) - weekOffset(todayDate) : 0
  const byWeek = new Map<number, MenuPlanDayDto[]>()
  for (const day of upcoming) {
    const week = Math.round((dayNumber(day.date) - weekOffset(day.date) - baseWeek) / 7)
    byWeek.set(week, [...(byWeek.get(week) ?? []), day])
  }

  const weeks: Week[] = []
  for (const [week, weekDays] of byWeek) {
    const segments: Segment[] = []
    for (const day of weekDays) {
      const last = segments[segments.length - 1]
      if (day.isPlanned) segments.push({ kind: 'day', day })
      else if (last?.kind === 'gap') { last.days.push(day); anchorOf.set(day.date, last.days[0].date) }
      else { segments.push({ kind: 'gap', days: [day] }); anchorOf.set(day.date, day.date) }
    }
    const visible = filter === 'planned' ? segments.filter((segment) => segment.kind === 'day') : segments
    const [head] = weekDays
    if (!head || visible.length === 0) continue
    const first = persianDayParts(head.date)
    const end = persianDayParts((weekDays[weekDays.length - 1] ?? head).date)
    weeks.push({
      key: String(week),
      title: weekTitles[week] ?? `${formatNumber(week)} هفته بعد`,
      range: weekDays.length > 1 ? `${first.day} تا ${end.day} ${end.month}` : `${end.day} ${end.month}`,
      segments: visible,
    })
  }

  return { today, todayDate, stats, weeks, anchorOf }
}

function PlanHero({ plan, stats }: { plan: MenuPlanDto; stats: Stats }) {
  const coverage = stats.remaining > 0 ? Math.round((stats.withMenu / stats.remaining) * 100) : 0
  return <section className="plan-hero">
    <div className="plan-hero-copy">
      <span className="plan-hero-eyebrow"><Icon name="calendar" size="sm" /> برنامه غذایی ماه</span>
      <h1>{plan.monthTitle}</h1>
      <p>ببینید تا پایان ماه چه غذاهایی در راه است و روزهای محبوبتان را از همین حالا پیدا کنید.</p>
    </div>
    <dl className="plan-hero-stats">
      <div><dt>روز باقی‌مانده</dt><dd>{formatNumber(stats.remaining)}</dd></div>
      <div><dt>روز با منو</dt><dd>{formatNumber(stats.withMenu)}</dd></div>
      {stats.lowestPrice != null && <div><dt>شروع قیمت از</dt><dd className="is-price">{formatMoney(stats.lowestPrice)}</dd></div>}
    </dl>
    <div className="plan-hero-progress">
      <div className="plan-hero-progress-label">
        <span>منوی {formatNumber(stats.withMenu)} روز از {formatNumber(stats.remaining)} روز اعلام شده</span>
        <strong>{formatNumber(coverage)}٪</strong>
      </div>
      <div className="plan-hero-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage} aria-label="پوشش برنامه ماه">
        <span style={{ inlineSize: `${coverage}%` }} />
      </div>
    </div>
    <Icon name="food" className="plan-hero-art" aria-hidden="true" />
  </section>
}

function TodaySpotlight({ day, focused, onOpenToday }: { day: MenuPlanDayDto; focused: boolean; onOpenToday: () => void }) {
  const hidden = Math.max(0, day.foodCount - day.foods.length)
  const headline = day.isOpen && hasMenu(day)
    ? 'منوی امروز آماده سفارش است'
    : hasMenu(day) ? 'منوی امروز به‌زودی باز می‌شود' : 'منوی امروز هنوز اعلام نشده'

  return <section id={dayAnchorId(day.date)} className={`plan-today${focused ? ' is-focused' : ''}`} aria-label="امروز">
    <div className="plan-today-copy">
      <span className="plan-today-chip"><span className="plan-live-dot" aria-hidden="true" /> امروز · {formatPersianDay(day.date)}</span>
      <h2>{headline}</h2>
      {hasMenu(day) && <p className="plan-today-meta">
        <span><Icon name="food" size="sm" /> {formatNumber(day.foodCount)} غذا</span>
        {day.lowestPrice != null && <span><Icon name="discount" size="sm" /> از {formatMoney(day.lowestPrice)}</span>}
      </p>}
      {day.note && <p className="plan-note"><Icon name="info" size="sm" /> {day.note}</p>}
      {day.isOpen && hasMenu(day) && <button type="button" className="primary-button plan-today-cta" onClick={onOpenToday}>
        همین حالا سفارش بده <Icon name="back" size="sm" />
      </button>}
    </div>

    {day.foods.length > 0 && <ul className={`plan-today-foods count-${Math.min(day.foods.length + (hidden > 0 ? 1 : 0), 4)}`}>
      {day.foods.map((food) => <li key={food.foodId} className="plan-today-food">
        <FoodImage src={food.imageUrl} alt={food.title} />
        <span className="plan-today-food-caption">
          <strong>{food.title}</strong>
          <span>{formatMoney(food.price)}</span>
        </span>
      </li>)}
      {hidden > 0 && day.foods.length < 4 && <li className="plan-today-food is-more">
        <strong>+{formatNumber(hidden)}</strong><span>غذای دیگر</span>
      </li>}
    </ul>}
    {hidden > 0 && day.foods.length >= 4 && <span className="plan-today-more-badge">+{formatNumber(hidden)} غذای دیگر</span>}
  </section>
}

function PlanDayCard({ day, relative, order, focused }: { day: MenuPlanDayDto; relative: string | null; order: number; focused: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const parts = persianDayParts(day.date)
  const hidden = Math.max(0, day.foodCount - day.foods.length)
  const named = day.foods.slice(0, 2).map((food) => food.title)
  const unnamed = day.foodCount - named.length
  const listId = `${dayAnchorId(day.date)}-foods`
  const classes = ['plan-day', !hasMenu(day) && 'is-empty', weekOffset(day.date) === 6 && 'is-friday', focused && 'is-focused', isExpanded && 'is-expanded']
    .filter(Boolean).join(' ')

  return <article id={dayAnchorId(day.date)} className={classes} style={{ '--plan-order': order } as CSSProperties}>
    <div className="plan-day-date">
      <span>{parts.weekday}</span>
      <strong>{parts.day}</strong>
      <span>{parts.month}</span>
    </div>

    <div className="plan-day-body">
      <div className="plan-day-tags">
        {relative && <span className="plan-tag is-relative">{relative}</span>}
        {day.isOpen && <span className="plan-tag is-open">باز برای سفارش</span>}
      </div>

      {day.foods.length > 0 ? <>
        <div className="plan-day-summary">
          <div className="plan-avatars" aria-hidden="true">
            {day.foods.map((food) => <span className="plan-avatar" key={food.foodId}><FoodImage src={food.imageUrl} alt={food.title} /></span>)}
            {hidden > 0 && <span className="plan-avatar is-more">+{formatNumber(hidden)}</span>}
          </div>
          <p className="plan-day-names">
            <strong>{named.join('، ')}</strong>
            {unnamed > 0 && <> و {formatNumber(unnamed)} غذای دیگر</>}
          </p>
        </div>

        {isExpanded && <ul className="plan-day-foods" id={listId}>
          {day.foods.map((food) => <li key={food.foodId}>
            <span className="plan-day-food-thumb"><FoodImage src={food.imageUrl} alt={food.title} /></span>
            <span className="plan-day-food-name">{food.title}</span>
            <span className="plan-day-food-price">{formatMoney(food.price)}</span>
          </li>)}
          {hidden > 0 && <li className="plan-day-foods-more">و {formatNumber(hidden)} غذای دیگر در منوی این روز</li>}
        </ul>}

        <footer className="plan-day-foot">
          {day.lowestPrice != null && <span className="plan-day-price">از <strong>{formatMoney(day.lowestPrice)}</strong></span>}
          <button type="button" className="plan-day-toggle" aria-expanded={isExpanded} aria-controls={listId} onClick={() => setIsExpanded((value) => !value)}>
            {isExpanded ? 'بستن' : 'غذاها و قیمت‌ها'} <Icon name={isExpanded ? 'minus' : 'add'} size="xs" />
          </button>
        </footer>
      </> : <p className="plan-day-empty">منوی این روز ثبت شده ولی هنوز غذایی به آن اضافه نشده است.</p>}

      {day.note && <p className="plan-note"><Icon name="info" size="sm" /> {day.note}</p>}
    </div>
  </article>
}

function PlanGap({ days, order, focused }: { days: DayRun; order: number; focused: boolean }) {
  const first = persianDayParts(days[0].date)
  const last = persianDayParts((days[days.length - 1] ?? days[0]).date)
  const label = days.length > 1
    ? `${first.weekday} ${first.day} تا ${last.weekday} ${last.day}`
    : `${first.weekday} ${first.day} ${first.month}`

  return <div id={dayAnchorId(days[0].date)} className={`plan-gap${focused ? ' is-focused' : ''}`} style={{ '--plan-order': order } as CSSProperties}>
    <span className="plan-gap-icon"><Icon name="clock" size="sm" /></span>
    <span className="plan-gap-copy">
      <strong>{label}</strong>
      <span>{days.length > 1 ? `برنامه این ${formatNumber(days.length)} روز به‌زودی اعلام می‌شود` : 'برنامه این روز به‌زودی اعلام می‌شود'}</span>
    </span>
  </div>
}

function PlanSkeleton() {
  return <main className="menu-plan-page" aria-busy="true">
    <span className="plan-sr-only" role="status">در حال دریافت برنامه ماه…</span>
    <div className="plan-skeleton is-hero" />
    <div className="plan-skeleton is-strip" />
    <div className="plan-skeleton is-today" />
    <div className="plan-week-grid">
      {[0, 1, 2, 3].map((item) => <div className="plan-skeleton is-card" key={item} />)}
    </div>
  </main>
}
