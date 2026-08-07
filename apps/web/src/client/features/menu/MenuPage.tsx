import { normalizePersianSearch } from '@kafgir/contracts'
import type { CartItem, DailyMenuItemDto, PublicDailyMenuPageDto } from '../../types'
import { BrandedState } from '../../design-system/BrandedState'
import { Icon } from '../../design-system/Icon'
import { getTodayMenu } from '../../services/menuApi'
import { DiscountShowcase } from './DiscountShowcase'
import { HeroCarousel } from './HeroCarousel'
import { MenuItemCard } from './MenuItemCard'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const pageSize = 12
const searchDelayMs = 300

type Props = {
  menu: PublicDailyMenuPageDto | null
  isLoading: boolean
  error: string | null
  cartItems: CartItem[]
  onRetry: () => void
  onAdd: (item: DailyMenuItemDto, withPersianRice?: boolean) => void
  onQuantityChange: (id: number, quantity: number, withPersianRice?: boolean) => void
}

type LoadMode = 'reset' | 'append' | 'refresh'

export function MenuPage({ menu, isLoading, error, cartItems, onRetry, onAdd, onQuantityChange }: Props) {
  const [currentMenu, setCurrentMenu] = useState(menu)
  const [items, setItems] = useState<DailyMenuItemDto[]>(menu?.items ?? [])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [totalItems, setTotalItems] = useState(menu?.totalItems ?? 0)
  const [nextCursor, setNextCursor] = useState<number | null>(menu?.nextCursor ?? null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const loadingMore = useRef(false)
  const initializedFilters = useRef(false)
  const activeMenuId = useRef(menu?.id ?? null)
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null)
  const nextCursorRef = useRef<number | null>(menu?.nextCursor ?? null)
  const loadedItemCountRef = useRef(menu?.items.length ?? 0)
  const debouncedQueryRef = useRef('')
  const effectiveCategoryRef = useRef('all')

  const normalizedQuery = normalizePersianSearch(searchQuery)
  const queryIsTooShort = normalizedQuery.length === 1
  const serverQuery = normalizedQuery.length >= 2 ? normalizedQuery : ''

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(serverQuery), searchDelayMs)
    return () => window.clearTimeout(timer)
  }, [serverQuery])

  useEffect(() => {
    setCurrentMenu(menu)
    if ((menu?.id ?? null) !== activeMenuId.current) {
      activeMenuId.current = menu?.id ?? null
      setItems(menu?.items ?? [])
      setTotalItems(menu?.totalItems ?? 0)
      setNextCursor(menu?.nextCursor ?? null)
      setSelectedCategory('all')
      setSearchQuery('')
      setDebouncedQuery('')
    }
  }, [menu])

  const visibleCategoryOptions = useMemo(() => [
    { key: 'all', label: 'همه' },
    ...(currentMenu?.categories.map((category) => ({
      key: category.slug,
      label: `${category.icon ? `${category.icon} ` : ''}${category.title}`,
    })) ?? []),
  ], [currentMenu?.categories])
  const selectedCategoryExists = visibleCategoryOptions.some((category) => category.key === selectedCategory)
  const effectiveCategory = selectedCategoryExists ? selectedCategory : 'all'
  const showDiscounts = normalizedQuery.length === 0 && effectiveCategory === 'all'
  nextCursorRef.current = nextCursor
  loadedItemCountRef.current = items.length
  debouncedQueryRef.current = debouncedQuery
  effectiveCategoryRef.current = effectiveCategory

  const loadResults = useCallback(async (mode: LoadMode) => {
    if (mode === 'append') {
      if (!nextCursorRef.current || loadingMore.current) return
      loadingMore.current = true
      setIsLoadingMore(true)
    } else if (mode === 'reset') {
      setIsSearching(true)
    }

    const sequence = ++requestSequence.current
    setResultError(null)
    try {
      let result = await getTodayMenu({
        q: debouncedQueryRef.current || undefined,
        category: effectiveCategoryRef.current === 'all' ? undefined : effectiveCategoryRef.current,
        cursor: mode === 'append' ? nextCursorRef.current : undefined,
        limit: mode === 'refresh' ? Math.min(60, Math.max(pageSize, loadedItemCountRef.current)) : pageSize,
      })
      if (mode === 'refresh' && result) {
        const targetCount = Math.max(pageSize, loadedItemCountRef.current)
        const refreshedItems = [...result.items]
        let refreshCursor = result.nextCursor
        while (refreshCursor && refreshedItems.length < targetCount) {
          const page = await getTodayMenu({
            q: debouncedQueryRef.current || undefined,
            category: effectiveCategoryRef.current === 'all' ? undefined : effectiveCategoryRef.current,
            cursor: refreshCursor,
            limit: Math.min(60, targetCount - refreshedItems.length),
          })
          if (!page) break
          refreshedItems.push(...page.items)
          refreshCursor = page.nextCursor
        }
        result = { ...result, items: refreshedItems, nextCursor: refreshCursor }
      }
      if (sequence !== requestSequence.current) return
      if (!result) {
        setCurrentMenu(null)
        setItems([])
        setTotalItems(0)
        setNextCursor(null)
        return
      }

      setCurrentMenu(result)
      setTotalItems(result.totalItems)
      setNextCursor(result.nextCursor)
      setItems((current) => {
        if (mode !== 'append') return result.items
        const known = new Set(current.map((item) => item.id))
        return [...current, ...result.items.filter((item) => !known.has(item.id))]
      })
    } catch (loadError) {
      if (sequence !== requestSequence.current) return
      setResultError(loadError instanceof Error ? loadError.message : 'دریافت غذاهای بیشتر ممکن نشد.')
    } finally {
      if (sequence === requestSequence.current) {
        setIsSearching(false)
        setIsLoadingMore(false)
      }
      if (mode === 'append') loadingMore.current = false
    }
  }, [])

  useEffect(() => {
    if (!initializedFilters.current) {
      initializedFilters.current = true
      return
    }
    void loadResults('reset')
  }, [debouncedQuery, effectiveCategory, loadResults])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadResults('refresh')
    }
    const interval = window.setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [loadResults])

  useEffect(() => {
    const sentinel = loadMoreSentinel.current
    if (!sentinel || !nextCursor || isSearching || resultError) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadResults('append')
    }, { rootMargin: '280px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isSearching, loadResults, nextCursor, resultError])

  if (isLoading && !currentMenu) return <BrandedState animated title="در حال چیدن سفره امروز…" message="چند لحظه صبر کنید تا غذاهای تازه را بیاوریم." />
  if (error && !currentMenu) return <BrandedState title="دریافت منو ممکن نشد" message={error} tone="error" icon="info"><button className="outline-button" onClick={onRetry}><Icon name="refresh" size="md" />تلاش دوباره</button></BrandedState>
  if (!currentMenu) return <BrandedState title="امروز منویی ثبت نشده است" message="به‌زودی غذاهای خانگی تازه اینجا قرار می‌گیرند." />
  if (!currentMenu.isOpen) return <BrandedState title="سفارش‌گیری امروز بسته است" message="برای منوی بعدی دوباره به کفگیر سر بزنید." tone="warning" icon="clock" />

  return <main>
    <section className="menu-intro">
      <HeroCarousel images={menu?.items.map((item) => item.imageUrl) ?? []} />
      <div className="menu-intro-copy">
        <span className="eyebrow"><Icon name="freshIngredients" size="sm" /> سفره امروز کفگیر</span>
        <h1 className="section-title">طعم خونه،<br /><span>آماده سفارش</span></h1>
        <p className="section-subtitle">{currentMenu.note || 'غذای تازه و خانگی در اندیمشک'}</p>
        <div className="menu-intro-promises" aria-label="ویژگی‌های غذای امروز">
          <span><Icon name="clock" size="sm" /> پخت روز</span>
          <span><Icon name="freshIngredients" size="sm" /> مواد تازه</span>
        </div>
      </div>
      <div className="menu-intro-accent" aria-hidden="true"><i /><i /><i /></div>
    </section>

    <section className="menu-search" role="search" aria-label="جستجو در منوی امروز">
      <label className="menu-search-label" htmlFor="today-menu-search">جستجو در منوی امروز</label>
      <div className="menu-search-control">
        <Icon className="menu-search-icon" name="search" size="md" />
        <input
          id="today-menu-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="جستجو در منوی امروز"
        />
        {normalizedQuery && (
          <button type="button" className="menu-search-clear" onClick={() => setSearchQuery('')} aria-label="پاک کردن عبارت جستجو">
            <Icon name="cancel" size="sm" />
          </button>
        )}
      </div>
      {normalizedQuery && <span className="menu-search-count" aria-live="polite" aria-atomic="true">
          {queryIsTooShort
            ? 'برای جستجو حداقل 2 حرف بنویسید'
            : isSearching ? 'در حال جستجو…' : `${totalItems} غذا پیدا شد`}
        </span>}
    </section>

    {showDiscounts && <DiscountShowcase
      items={currentMenu.discountItems ?? []}
      persianRice={currentMenu.persianRice ?? null}
      cartItems={cartItems}
      onAdd={onAdd}
      onQuantityChange={onQuantityChange}
    />}

    <section id="menu-categories" className="category-strip" aria-label="دسته‌بندی غذاهای امروز">
      <div className="category-strip-title"><Icon name="categories" size="sm" /><span>دسته‌بندی</span></div>
      <div className="category-chips" role="list">
        {visibleCategoryOptions.map((category) => (
          <button key={category.key} type="button"
            className={effectiveCategory === category.key ? 'category-chip active' : 'category-chip'}
            onClick={() => setSelectedCategory(category.key)} aria-pressed={effectiveCategory === category.key}>
            {category.label}
          </button>
        ))}
      </div>
    </section>

    {resultError && <div className="menu-results-error" role="alert">
      <span>{resultError}</span>
      <button type="button" className="outline-button" onClick={() => void loadResults('reset')}>
        <Icon name="refresh" size="sm" /> تلاش دوباره
      </button>
    </div>}

    {isSearching
      ? <BrandedState animated title="در حال جستجوی غذاها…" message="نتیجه‌های تازه تا چند لحظه دیگر نمایش داده می‌شوند." icon="search" />
      : totalItems === 0
        ? <section className="menu-search-empty" role="status">
          <Icon name="search" size="xl" />
          <h2>غذایی با این مشخصات پیدا نشد</h2>
          <p>عبارت دیگری بنویسید یا فیلتر دسته‌بندی را پاک کنید.</p>
          <button type="button" className="outline-button" onClick={() => {
            setSearchQuery('')
            setSelectedCategory('all')
          }}><Icon name="cancel" size="sm" /> حذف فیلترها</button>
        </section>
        : <>
          <div className="menu-grid">{items.map((item) => (
            <MenuItemCard key={item.id} item={item}
              persianRice={currentMenu.persianRice ?? null}
              cartItems={cartItems}
              onAdd={onAdd} onQuantityChange={onQuantityChange} />
          ))}</div>
          {nextCursor && <div ref={loadMoreSentinel} className="menu-load-more" aria-live="polite">
            {isLoadingMore
              ? <><span className="menu-load-spinner" aria-hidden="true" /> در حال آوردن غذاهای بیشتر…</>
              : <button type="button" className="outline-button" onClick={() => void loadResults('append')}>نمایش غذاهای بیشتر</button>}
          </div>}
          {!nextCursor && items.length > 0 && <p className="menu-results-end">همه {totalItems} غذا نمایش داده شد.</p>}
        </>}
  </main>
}
