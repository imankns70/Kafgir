'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { FoodDetailDto } from '@kafgir/contracts'
import type { CartItem } from '../../types'
import { BrandLogo } from '../../design-system/BrandLogo'
import { FoodImage } from '../../design-system/FoodImage'
import { Icon } from '../../design-system/Icon'
import { PriceDisplay } from '../../design-system/PriceDisplay'
import { RiceUpgradeDialog } from '../../design-system/RiceUpgradeDialog'
import { addStoredCartItem, loadStoredCart, setStoredCartItemQuantity } from '../../services/cartStorage'
import { getCustomerSession, loginCustomerWithTelegram } from '../../services/customerApi'
import { favoriteFood, getFoodDetails, likeFood } from '../../services/foodDiscoveryApi'
import { bindTelegramBackButton, getTelegramInitData } from '../../services/telegram'
import { formatMoney, formatNumber } from '../../utils/format'

type FoodCatalogDetail = Pick<
  FoodDetailDto,
  | 'foodId'
  | 'slug'
  | 'title'
  | 'isActive'
  | 'shortDescription'
  | 'fullDescription'
  | 'category'
  | 'tags'
  | 'allowsPersianRice'
  | 'primaryBadge'
  | 'images'
  | 'ingredients'
  | 'portionDescription'
  | 'allergyInformation'
  | 'preparationTimeMinutes'
>

type Props = {
  slug: string
  initialCatalog: FoodCatalogDetail
}

const lowStockThreshold = 5

// Ingredients are typed as one comma-separated sentence in the admin; shown as chips they scan faster.
export function splitIngredients(value: string | null): string[] {
  if (!value) return []
  return value.split(/[،,]/u).map((part) => part.trim().replace(/[.。]$/u, '').trim()).filter(Boolean)
}

export function FoodDetailPage({ slug, initialCatalog }: Props) {
  const searchParams = useSearchParams()
  const menuItemId = useMemo(() => {
    const value = searchParams.get('menuItemId')
    return value && Number.isInteger(Number(value)) ? Number(value) : null
  }, [searchParams])

  const [food, setFood] = useState<FoodDetailDto | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interactionBusy, setInteractionBusy] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [withPersianRice, setWithPersianRice] = useState(false)
  const [confirmingRice, setConfirmingRice] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getFoodDetails(slug, menuItemId)
      setFood(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات روز غذا ممکن نشد.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [slug, menuItemId])
  useEffect(() => {
    const refreshPrice = async () => {
      if (document.visibilityState !== 'visible') return
      try { setFood(await getFoodDetails(slug, menuItemId)) } catch { /* Keep the last valid live state. */ }
    }
    const interval = window.setInterval(() => void refreshPrice(), 15_000)
    window.addEventListener('focus', refreshPrice)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshPrice)
    }
  }, [slug, menuItemId])
  useEffect(() => bindTelegramBackButton(() => history.back()), [])
  useEffect(() => {
    let isActive = true
    const loadSession = async () => {
      try {
        let session = await getCustomerSession()
        const initData = getTelegramInitData()
        if (!session.authenticated && initData) session = await loginCustomerWithTelegram(initData)
        if (isActive) setIsCustomerAuthenticated(session.authenticated)
      } catch {
        if (isActive) setIsCustomerAuthenticated(false)
      }
    }
    void loadSession()
    return () => { isActive = false }
  }, [])
  useEffect(() => { setActiveImage(0) }, [initialCatalog.foodId])
  useEffect(() => {
    const storedCart = loadStoredCart()
    setCartItems(storedCart)
    setCartCount(storedCart.length)
  }, [food?.menuItemId])

  const menuContext = useMemo(() => {
    if (!food?.menuDate) return null
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const tomorrow = new Date(`${today}T00:00:00+03:30`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowText = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(tomorrow)
    // The API sends the date as an ISO timestamp; only its calendar day matters here.
    const menuDay = food.menuDate.slice(0, 10)
    return menuDay === today ? 'منوی امروز' : menuDay === tomorrowText ? 'منوی فردا' : 'منوی روز'
  }, [food?.menuDate])

  const changeInteraction = async (kind: 'like' | 'favorite') => {
    if (!food || interactionBusy) return
    setInteractionBusy(true)
    setError(null)
    try {
      const state = kind === 'like'
        ? await likeFood(food.slug, !food.isLikedByCurrentUser)
        : await favoriteFood(food.slug, !food.isFavoriteByCurrentUser)
      setFood({
        ...food,
        likeCount: state.likeCount,
        isLikedByCurrentUser: state.isLikedByCurrentUser,
        isFavoriteByCurrentUser: state.isFavoriteByCurrentUser,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'انجام این کار ممکن نشد.')
    } finally {
      setInteractionBusy(false)
    }
  }

  const addToCart = (upgraded = withPersianRice) => {
    if (!food?.menuItemId || !food.price || !food.isOrderable) return
    const rice = upgraded && food.allowsPersianRice ? food.persianRice : null
    const remaining = Math.min(food.remainingCapacity, rice?.remainingPortions ?? food.remainingCapacity)
    const nextCart = addStoredCartItem({
      dailyMenuItemId: food.menuItemId,
      foodId: food.foodId,
      slug: food.slug,
      withPersianRice: rice != null,
      persianRiceTitle: rice?.title ?? null,
      persianRicePrice: rice?.price ?? 0,
      foodName: food.title,
      unitPrice: food.price,
      originalUnitPrice: food.originalPrice ?? null,
      discountPercentage: food.discountPercentage ?? null,
      quantity: 1,
      remainingPortions: remaining,
    })
    setCartItems(nextCart)
    setCartCount(nextCart.length)
  }

  const changeCartQuantity = (quantity: number, upgraded = false) => {
    if (!food?.menuItemId) return
    const nextCart = setStoredCartItemQuantity(food.menuItemId, quantity, upgraded)
    setCartItems(nextCart)
    setCartCount(nextCart.length)
  }

  const imageCount = initialCatalog.images.length
  const primaryImage = initialCatalog.images[activeImage]?.imageUrl ?? null
  const showCarouselControls = imageCount > 1
  const showPreviousImage = () => setActiveImage((current) => (current - 1 + imageCount) % imageCount)
  const showNextImage = () => setActiveImage((current) => (current + 1) % imageCount)
  const rice = food?.persianRice ?? null
  const riceAvailable = Boolean(rice?.isAvailable && rice.remainingPortions > 0)
  const offersRice = Boolean(food?.allowsPersianRice && rice != null)
  // Same rule as the menu card: the checkbox chooses what the next add does, and the other basket
  // variant is named rather than silently hidden.
  const lines = food?.menuItemId
    ? cartItems.filter((item) => item.dailyMenuItemId === food.menuItemId)
    : []
  const upgradedInCart = lines.some((item) => item.withPersianRice)
  const upgradedQuantity = lines.find((item) => Boolean(item.withPersianRice) === withPersianRice)?.quantity ?? 0
  const otherLine = lines.find((item) => Boolean(item.withPersianRice) !== withPersianRice)

  const renderPurchaseBar = (className: string) => {
    if (!food) {
      return <div className={className}>
        <div className="food-purchase-action">
          <div>
            <strong>{loading ? 'در حال دریافت قیمت و ظرفیت…' : 'اطلاعات سفارش در دسترس نیست'}</strong>
          </div>
          <button className="primary-button add-button" disabled>
            <Icon name="cart" size="sm" /><span>در حال بررسی موجودی</span>
          </button>
        </div>
      </div>
    }

    return <div className={className}>
      {offersRice && rice && <label className="rice-upgrade-option rice-upgrade-option-card">
        <input type="checkbox" role="switch" checked={withPersianRice} disabled={!riceAvailable && !upgradedInCart}
          onChange={(event) => event.target.checked ? setConfirmingRice(true) : setWithPersianRice(false)} />
        <span className="rice-upgrade-label">{riceAvailable || upgradedInCart
          ? 'با برنج ایرانی'
          : 'برنج ایرانی امروز تمام شده است'}</span>
        {(riceAvailable || upgradedInCart) && <span className="rice-upgrade-price">+{formatMoney(rice.price)}</span>}
      </label>}
      {otherLine && <small className="cart-variant-hint">
        {formatNumber(otherLine.quantity)} پرس {otherLine.withPersianRice ? 'با برنج ایرانی' : 'بدون برنج ایرانی'} هم در سبد شماست
      </small>}
      <div className="food-purchase-action">
        <PriceDisplay
          price={(food.price ?? 0) + (withPersianRice && rice ? rice.price : 0)}
          originalPrice={food.originalPrice}
          discountPercentage={food.discountPercentage}
          showDiscountPill={false}
        />
        {upgradedQuantity > 0
          ? <div className="add-button quantity-add-control" aria-label={`${initialCatalog.title} در سبد خرید`}>
              <button
                type="button"
                className="quantity-add-button"
                onClick={() => changeCartQuantity(upgradedQuantity - 1, withPersianRice)}
                aria-label={upgradedQuantity === 1 ? `حذف ${initialCatalog.title} از سبد` : `کم کردن ${initialCatalog.title}`}
              >
                <Icon name={upgradedQuantity === 1 ? 'delete' : 'minus'} size="sm" />
              </button>
              <span className="quantity-add-status">
                <span>{formatNumber(upgradedQuantity)}</span>
                <small>در سبد</small>
              </span>
              <button
                type="button"
                className="quantity-add-button"
                onClick={() => addToCart()}
                disabled={upgradedQuantity >= food.remainingCapacity}
                aria-label={`اضافه کردن ${initialCatalog.title}`}
              >
                <Icon name="add" size="sm" />
              </button>
            </div>
          : <button type="button" className="primary-button add-button" disabled={!food.isOrderable} onClick={() => addToCart()}
              aria-label={food.isOrderable ? `افزودن ${initialCatalog.title} به سبد خرید` : food.availabilityReason}>
              {food.isOrderable
                ? <><Icon name="add" size="sm" /><span>{withPersianRice ? 'افزودن با برنج' : 'افزودن به سبد'}</span></>
                : <span>فعلاً قابل سفارش نیست</span>}
            </button>}
      </div>
    </div>
  }

  const ingredients = splitIngredients(initialCatalog.ingredients)
  const hasStory = Boolean(initialCatalog.fullDescription)
  const lowStock = Boolean(food?.isOrderable && food.remainingCapacity > 0 && food.remainingCapacity <= lowStockThreshold)
  const orderDeadline = food?.orderDeadline
    ? new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(food.orderDeadline))
    : null

  return <div className="app-shell food-detail-shell">
    <header className="app-header food-detail-header">
      <Link className="brand-home-link" href="/" aria-label="بازگشت به صفحه اصلی کفگیر">
        <BrandLogo variant="compact" />
      </Link>
      <div className="food-detail-header-actions">
        <Link className="icon-action food-detail-cart-action" href="/?page=cart" aria-label={`سبد خرید، ${cartCount} قلم`}>
          <span className="nav-icon-wrap"><Icon name="cart" />{cartCount > 0 && <span className="nav-count">{formatNumber(cartCount)}</span>}</span>
        </Link>
        {isCustomerAuthenticated && food && <button className={food.isFavoriteByCurrentUser ? 'icon-action active' : 'icon-action'} disabled={interactionBusy}
          onClick={() => void changeInteraction('favorite')} aria-label="افزودن یا حذف از علاقه‌مندی‌ها"><Icon name="favorite" /></button>}
        <button type="button" className="checkout-back-link" onClick={() => history.back()}>
          بازگشت <Icon name="back" size="sm" />
        </button>
      </div>
    </header>

    <main className="food-detail-page">
      <section className="food-detail-gallery">
        <div className="food-detail-main-image" aria-roledescription="carousel" aria-label={`تصاویر ${initialCatalog.title}`}>
          <FoodImage src={primaryImage} alt={initialCatalog.images[activeImage]?.altText || initialCatalog.title} />
          {(initialCatalog.primaryBadge || food?.discountPercentage) && <div className="menu-card-badges">
            {initialCatalog.primaryBadge && <span className="menu-card-badge">
              {initialCatalog.primaryBadge.icon && <span aria-hidden="true">{initialCatalog.primaryBadge.icon}</span>}
              {initialCatalog.primaryBadge.title}
            </span>}
            {food?.discountPercentage && <span className="menu-card-badge is-discount">
              <Icon name="discount" size="xs" /> {formatNumber(food.discountPercentage)}٪ تخفیف
            </span>}
          </div>}
          {showCarouselControls && <>
            <button type="button" className="food-gallery-arrow previous" onClick={showPreviousImage} aria-label="تصویر قبلی">
              <Icon name="forward" size="sm" />
            </button>
            <button type="button" className="food-gallery-arrow next" onClick={showNextImage} aria-label="تصویر بعدی">
              <Icon name="back" size="sm" />
            </button>
            <div className="food-gallery-dots">
              {initialCatalog.images.map((image, index) => <button key={image.id} type="button"
                className={activeImage === index ? 'active' : ''}
                aria-current={activeImage === index ? 'true' : undefined}
                onClick={() => setActiveImage(index)} aria-label={`نمایش تصویر ${formatNumber(index + 1)}`} />)}
            </div>
          </>}
        </div>
        {showCarouselControls && <div className="food-detail-thumbnails">
          {initialCatalog.images.map((image, index) => <button key={image.id} type="button" className={activeImage === index ? 'active' : ''}
            aria-current={activeImage === index ? 'true' : undefined}
            onClick={() => setActiveImage(index)} aria-label={`نمایش تصویر ${formatNumber(index + 1)}`}>
            <img src={image.imageUrl} alt={image.altText} />
          </button>)}
        </div>}
        {renderPurchaseBar('food-purchase-bar food-purchase-bar-desktop')}
      </section>

      <section className="food-detail-content">
        <header className="food-detail-summary">
          <div className="food-detail-kicker">
            <span>{initialCatalog.category.icon} {initialCatalog.category.title}</span>
            {menuContext && <span><Icon name="freshIngredients" size="xs" /> {menuContext === 'منوی امروز' ? 'پخت تازه امروز' : menuContext}</span>}
          </div>
          <h1>{initialCatalog.title}</h1>
          {initialCatalog.shortDescription && <p className="food-detail-lead">{initialCatalog.shortDescription}</p>}
          <div className="food-detail-facts">
            {initialCatalog.preparationTimeMinutes && <div className="food-fact">
              <Icon name="clock" size="md" />
              <strong>{formatNumber(initialCatalog.preparationTimeMinutes)} دقیقه</strong>
              <small>زمان پخت</small>
            </div>}
            {food && <div className="food-fact">
              <Icon name="calendar" size="md" />
              <strong>{menuContext ?? 'خارج از منو'}</strong>
              <small>زمان سرو</small>
            </div>}
            {food && <button type="button" className={food.isLikedByCurrentUser ? 'food-fact food-like active' : 'food-fact food-like'} disabled={interactionBusy}
              aria-pressed={food.isLikedByCurrentUser}
              onClick={() => void changeInteraction('like')}>
              <Icon name="favorite" size="md" />
              <strong>{formatNumber(food.likeCount)}</strong>
              <small>{food.isLikedByCurrentUser ? 'پسندیدید' : 'پسند'}</small>
            </button>}
          </div>
          {initialCatalog.tags.length > 0 && <div className="food-tag-list">{initialCatalog.tags.map((tag) =>
            <span key={tag.id}>{tag.icon} {tag.title}</span>)}</div>}
        </header>

        {food
          ? <div className={`food-detail-availability${food.isOrderable ? '' : ' is-closed'}${lowStock ? ' is-low' : ''}`} role="status">
              <span className="food-availability-dot" aria-hidden="true" />
              <strong>{lowStock ? `فقط ${formatNumber(food.remainingCapacity)} پرس باقی مانده` : food.availabilityReason}</strong>
              {orderDeadline && food.isOrderable && <small><Icon name="clock" size="xs" /> مهلت سفارش {orderDeadline}</small>}
            </div>
          : <div className="food-detail-availability is-loading" aria-live="polite">
              <span className="food-availability-dot" aria-hidden="true" />
              <strong>{loading ? 'در حال بررسی منوی روز…' : 'اطلاعات منوی روز دریافت نشد.'}</strong>
            </div>}
        {error && <div className="form-error" role="alert">{error}</div>}

        {hasStory && <section className="food-detail-section">
          <h2><Icon name="homeCook" size="sm" /> معرفی غذا</h2>
          <p>{initialCatalog.fullDescription}</p>
        </section>}
        {initialCatalog.portionDescription && <section className="food-detail-section">
          <h2><Icon name="packaging" size="sm" /> در هر پرس</h2>
          <p>{initialCatalog.portionDescription}</p>
        </section>}
        {ingredients.length > 0 && <section className="food-detail-section">
          <h2><Icon name="freshIngredients" size="sm" /> مواد اولیه</h2>
          <ul className="food-ingredient-list">{ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>
        </section>}
        {initialCatalog.allergyInformation && <section className="food-detail-section is-allergy">
          <h2><Icon name="info" size="sm" /> حساسیت‌زا</h2>
          <p>{initialCatalog.allergyInformation}</p>
        </section>}

        {food && food.relatedFoods.length > 0 && <section className="related-foods">
          <h2>شاید این‌ها را هم دوست داشته باشید</h2>
          <div className="related-foods-track">{food.relatedFoods.map((related) => <Link key={related.menuItemId} className="related-food-card"
            href={`/foods/${related.slug}?menuItemId=${related.menuItemId}`}>
            <span className="related-food-media">
              <FoodImage src={related.imageUrl} alt={related.title} />
              {related.discountPercentage && <span className="menu-card-badge is-discount">{formatNumber(related.discountPercentage)}٪</span>}
            </span>
            <strong>{related.title}</strong>
            {related.allowsPersianRice && <span className="rice-upgrade-hint">با امکان برنج ایرانی</span>}
            <PriceDisplay compact label="" price={related.price}
              originalPrice={related.originalPrice}
              discountPercentage={related.discountPercentage}
              showDiscountPill={false} />
          </Link>)}</div>
        </section>}
      </section>
    </main>

    {renderPurchaseBar('food-purchase-bar food-purchase-bar-mobile')}
    {/* The purchase bar is rendered twice (sticky mobile, inline desktop); the dialog belongs to the
        page so only one copy ever exists. */}
    {/* Both answers add the dish right away — the dialog is the add action, not just a toggle — so
        the customer never has to check a box and then hunt for a separate add button. */}
    {confirmingRice && rice && food && <RiceUpgradeDialog
      foodName={initialCatalog.title}
      basePrice={food.price ?? 0}
      ricePrice={rice.price}
      riceTitle={rice.title}
      onConfirm={() => { setWithPersianRice(true); addToCart(true); setConfirmingRice(false) }}
      onCancel={() => { setWithPersianRice(false); addToCart(false); setConfirmingRice(false) }}
    />}
  </div>
}
