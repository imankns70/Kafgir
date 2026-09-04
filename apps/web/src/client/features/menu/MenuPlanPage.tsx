import { useEffect, useState } from 'react'
import type { MenuPlanDayDto, MenuPlanDto } from '../../types'
import { Icon } from '../../design-system/Icon'
import { FoodImage } from '../../design-system/FoodImage'
import { BrandedState } from '../../design-system/BrandedState'
import { getMenuPlan } from '../../services/menuApi'
import { formatMoney, formatNumber, formatPersianDay } from '../../utils/format'

/**
 * The rest of the Persian month, a card per day.
 *
 * A day is recognised by its food, not by its date, so each card leads with the dishes: their
 * pictures first, then as many names as fit and a count for the rest. Days the kitchen has not
 * planned yet are shown too — an absent day would read as a day with no food, which is a promise
 * nobody has made.
 */
export function MenuPlanPage({ onBack, onOpenToday }: { onBack: () => void; onOpenToday: () => void }) {
  const [plan, setPlan] = useState<MenuPlanDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
  }, [])

  if (isLoading && !plan) return <BrandedState title="در حال دریافت برنامه ماه" message="کمی صبر کنید…" icon="calendar" />

  const plannedDays = plan?.days.filter((day) => day.isPlanned).length ?? 0

  return <main className="menu-plan-page">
    <div className="page-actions">
      <div>
        <span className="eyebrow"><Icon name="calendar" size="sm" /> برنامه ماه</span>
        <h1 className="section-title">{plan?.monthTitle ?? 'برنامه ماه'}</h1>
      </div>
      <button className="checkout-back-link" onClick={onBack}>منوی امروز <Icon name="back" size="sm" /></button>
    </div>

    {error && <div className="form-error" role="alert">{error}</div>}

    {plan && <p className="menu-plan-lead">
      {plannedDays > 0
        ? <>برای {formatNumber(plannedDays)} روز از باقیمانده این ماه غذا ثبت شده است.</>
        : <>هنوز برای روزهای پیش‌رو غذایی ثبت نشده است.</>}
    </p>}

    <div className="menu-plan-grid">
      {plan?.days.map((day) => <PlanDayCard key={day.date} day={day} onOpenToday={onOpenToday} />)}
    </div>
  </main>
}

function PlanDayCard({ day, onOpenToday }: { day: MenuPlanDayDto; onOpenToday: () => void }) {
  const hidden = Math.max(0, day.foodCount - day.foods.length)
  const state = day.isToday ? 'today' : day.isPlanned ? 'planned' : 'empty'

  return <article className={`menu-plan-card is-${state}`}>
    <header className="menu-plan-card-head">
      <div className="menu-plan-date">
        <strong>{formatPersianDay(day.date)}</strong>
        {day.isToday && <span className="menu-plan-today-chip">امروز</span>}
      </div>
      {day.isPlanned
        ? <span className={`menu-plan-state ${day.isOpen ? 'is-open' : 'is-closed'}`}>
            {day.isOpen ? 'باز برای سفارش' : 'هنوز باز نشده'}
          </span>
        : <span className="menu-plan-state is-unplanned">ثبت نشده</span>}
    </header>

    {day.foods.length > 0 ? <>
      <div className="menu-plan-foods">
        {day.foods.map((food) => <span className="menu-plan-food" key={food.foodId}>
          <span className="menu-plan-food-thumb"><FoodImage src={food.imageUrl} alt={food.title} /></span>
          <span className="menu-plan-food-name">{food.title}</span>
        </span>)}
        {hidden > 0 && <span className="menu-plan-food menu-plan-more">
          <span className="menu-plan-food-thumb menu-plan-more-thumb">+{formatNumber(hidden)}</span>
          <span className="menu-plan-food-name">غذای دیگر</span>
        </span>}
      </div>
      <footer className="menu-plan-card-foot">
        <span>{formatNumber(day.foodCount)} غذا{day.lowestPrice != null && <> · از {formatMoney(day.lowestPrice)}</>}</span>
        {day.isToday && day.isOpen && <button type="button" className="primary-button menu-plan-open" onClick={onOpenToday}>
          سفارش امروز <Icon name="back" size="sm" />
        </button>}
      </footer>
    </> : <p className="menu-plan-empty">
      {day.isPlanned ? 'غذایی برای این روز ثبت نشده است.' : 'برنامه این روز هنوز اعلام نشده.'}
    </p>}

    {day.note && <p className="menu-plan-note">{day.note}</p>}
  </article>
}
