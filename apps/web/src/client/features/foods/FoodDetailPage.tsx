'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FoodDetailDto } from '@kafgir/contracts'
import { BrandLogo } from '../../design-system/BrandLogo'
import { FoodImage } from '../../design-system/FoodImage'
import { Icon } from '../../design-system/Icon'
import { BrandedState } from '../../design-system/BrandedState'
import { addStoredCartItem, loadStoredCart, setStoredCartItemQuantity } from '../../services/cartStorage'
import { getCustomerSession, loginCustomerWithTelegram } from '../../services/customerApi'
import { favoriteFood, getFoodDetails, likeFood } from '../../services/foodDiscoveryApi'
import { bindTelegramBackButton, getTelegramInitData } from '../../services/telegram'
import { formatMoney, formatNumber } from '../../utils/format'

type Props = { slug: string; menuItemId: number | null }

function FoodInfoSection({ title, value }: { title: string; value: string | null }) {
  return <section className="panel food-copy-section">
    <h2>{title}</h2>
    <p className={value ? undefined : 'muted'}>{value || 'ثبت نشده'}</p>
  </section>
}

export function FoodDetailPage({ slug, menuItemId }: Props) {
  const [food, setFood] = useState<FoodDetailDto | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interactionBusy, setInteractionBusy] = useState(false)
  const [cartQuantity, setCartQuantity] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getFoodDetails(slug, menuItemId)
      setFood(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت جزئیات غذا ممکن نشد.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [slug, menuItemId])
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
  useEffect(() => { setActiveImage(0) }, [food?.foodId])
  useEffect(() => {
    const storedCart = loadStoredCart()
    const item = food?.menuItemId ? storedCart.find((cartItem) => cartItem.dailyMenuItemId === food.menuItemId) : null
    setCartQuantity(item?.quantity ?? 0)
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
    return food.menuDate === today ? 'منوی امروز' : food.menuDate === tomorrowText ? 'منوی فردا' : 'منوی روز'
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

  const addToCart = () => {
    if (!food?.menuItemId || !food.price || !food.isOrderable) return
    const nextCart = addStoredCartItem({
      dailyMenuItemId: food.menuItemId,
      foodName: food.title,
      unitPrice: food.price,
      quantity: 1,
      remainingPortions: food.remainingCapacity,
    })
    setCartQuantity(nextCart.find((item) => item.dailyMenuItemId === food.menuItemId)?.quantity ?? 0)
    setCartCount(nextCart.length)
  }

  const changeCartQuantity = (quantity: number) => {
    if (!food?.menuItemId) return
    const nextCart = setStoredCartItemQuantity(food.menuItemId, quantity)
    setCartQuantity(nextCart.find((item) => item.dailyMenuItemId === food.menuItemId)?.quantity ?? 0)
    setCartCount(nextCart.length)
  }

  if (loading) return <div className="app-shell"><BrandedState animated title="در حال آماده‌کردن جزئیات غذا…" message="چند لحظه صبر کنید." /></div>
  if (error && !food) return <div className="app-shell"><BrandedState title="دریافت جزئیات ممکن نشد" message={error} tone="error"><button className="outline-button" onClick={() => void load()}>تلاش دوباره</button></BrandedState></div>
  if (!food) return <div className="app-shell"><BrandedState title="غذا پیدا نشد" message="ممکن است این غذا حذف شده باشد." tone="warning" /></div>

  const imageCount = food.images.length
  const primaryImage = food.images[activeImage]?.imageUrl ?? null
  const showCarouselControls = imageCount > 1
  const showPreviousImage = () => setActiveImage((current) => (current - 1 + imageCount) % imageCount)
  const showNextImage = () => setActiveImage((current) => (current + 1) % imageCount)
  const renderPurchaseBar = (className: string) => <div className={className}>
    <div className="menu-card-price"><span>قیمت هر پرس</span><strong className="price">{food.price !== null ? formatMoney(food.price) : '—'}</strong></div>
    {cartQuantity > 0
      ? <div className="add-button quantity-add-control" aria-label={`${food.title} در سبد خرید`}>
          <button
            type="button"
            className="quantity-add-button"
            onClick={() => changeCartQuantity(cartQuantity - 1)}
            aria-label={`کم کردن ${food.title}`}
          >
            <Icon name="minus" size="sm" />
          </button>
          <span className="quantity-add-status">
            <span>{formatNumber(cartQuantity)}</span>
            <small>در سبد خرید</small>
          </span>
          <button
            type="button"
            className="quantity-add-button"
            onClick={addToCart}
            disabled={cartQuantity >= food.remainingCapacity}
            aria-label={`اضافه کردن ${food.title}`}
          >
            <Icon name="add" size="sm" />
          </button>
        </div>
      : <button className="primary-button add-button" disabled={!food.isOrderable} onClick={addToCart}>
          <Icon name="cart" size="sm" /><span>افزودن به سبد خرید</span>
        </button>}
  </div>

  return <div className="app-shell food-detail-shell">
    <header className="app-header food-detail-header">
      <a className="brand-home-link" href="/" aria-label="بازگشت به صفحه اصلی کفگیر">
        <BrandLogo variant="compact" />
      </a>
      <div className="food-detail-header-actions">
        <a className="icon-action food-detail-cart-action" href="/?page=cart" aria-label={`سبد خرید، ${cartCount} قلم`}>
          <span className="nav-icon-wrap"><Icon name="cart" />{cartCount > 0 && <span className="nav-count">{formatNumber(cartCount)}</span>}</span>
        </a>
        {isCustomerAuthenticated && <button className={food.isFavoriteByCurrentUser ? 'icon-action active' : 'icon-action'} disabled={interactionBusy}
          onClick={() => void changeInteraction('favorite')} aria-label="افزودن یا حذف از علاقه‌مندی‌ها"><Icon name="favorite" /></button>}
        <button className="icon-action" onClick={() => history.back()} aria-label="بازگشت"><Icon name="back" /></button>
      </div>
    </header>

    <main className="food-detail-page">
      <section className="food-detail-gallery panel">
        <div className="food-detail-main-image" aria-roledescription="carousel" aria-label={`تصاویر ${food.title}`}>
          <FoodImage src={primaryImage} alt={food.images[activeImage]?.altText || food.title} />
          {food.primaryBadge && <span className="food-card-badge">{food.primaryBadge.icon} {food.primaryBadge.title}</span>}
          {showCarouselControls && <>
            <button className="food-gallery-arrow previous" onClick={showPreviousImage} aria-label="تصویر قبلی">
              <Icon name="forward" size="md" />
            </button>
            <button className="food-gallery-arrow next" onClick={showNextImage} aria-label="تصویر بعدی">
              <Icon name="back" size="md" />
            </button>
            <span className="food-gallery-counter">
              {formatNumber(activeImage + 1)} / {formatNumber(imageCount)}
            </span>
          </>}
        </div>
        {food.images.length > 1 && <div className="food-detail-thumbnails">
          {food.images.map((image, index) => <button key={image.id} className={activeImage === index ? 'active' : ''}
            aria-current={activeImage === index ? 'true' : undefined}
            onClick={() => setActiveImage(index)} aria-label={`نمایش تصویر ${formatNumber(index + 1)}`}>
            <img src={image.imageUrl} alt={image.altText} />
          </button>)}
        </div>}
        {renderPurchaseBar('food-purchase-bar food-purchase-bar-desktop')}
      </section>

      <section className="food-detail-content">
        <div className="panel food-detail-summary">
          <span className="food-category-label">{food.category.icon} {food.category.title}</span>
          <h1>{food.title}</h1>
          <div className="food-detail-facts">
            <button className={food.isLikedByCurrentUser ? 'food-like active' : 'food-like'} disabled={interactionBusy}
              onClick={() => void changeInteraction('like')}><Icon name="favorite" size="sm" /> {formatNumber(food.likeCount)} پسند</button>
            {food.preparationTimeMinutes && <span><Icon name="clock" size="sm" /> {formatNumber(food.preparationTimeMinutes)} دقیقه</span>}
            {menuContext && <span><Icon name="calendar" size="sm" /> {menuContext}</span>}
          </div>
          {food.tags.length > 0 && <div className="food-tag-list">{food.tags.map((tag) =>
            <span key={tag.id}>{tag.icon} {tag.title}</span>)}</div>}
        </div>

        <div className="food-detail-info-grid">
          <FoodInfoSection title="توضیح کوتاه" value={food.shortDescription} />
          <FoodInfoSection title="توضیح کامل" value={food.fullDescription} />
          <FoodInfoSection title="مقدار و محتویات هر پرس" value={food.portionDescription} />
          <FoodInfoSection title="مواد حساسیت زا" value={food.allergyInformation} />
        </div>
        {food.ingredients && <section className="panel food-copy-section"><h2>مواد اولیه</h2><p>{food.ingredients}</p></section>}

        <section className="panel current-menu-box">
          <div><strong>{food.price !== null ? formatMoney(food.price) : 'بدون قیمت روز'}</strong><span>{food.availabilityReason}</span></div>
          <div><span>{formatNumber(food.remainingCapacity)} پرس باقی‌مانده</span>
            {food.orderDeadline && <small>مهلت سفارش: {new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(food.orderDeadline))}</small>}</div>
        </section>
        {error && <div className="form-error" role="alert">{error}</div>}

        {food.relatedFoods.length > 0 && <section className="related-foods">
          <h2>غذاهای پیشنهادی</h2>
          <div>{food.relatedFoods.map((related) => <a key={related.menuItemId} href={`/foods/${related.slug}?menuItemId=${related.menuItemId}`}>
            <FoodImage src={related.imageUrl} alt={related.title} />
            <strong>{related.title}</strong><span>{formatMoney(related.price)}</span>
          </a>)}</div>
        </section>}
      </section>
    </main>

    {renderPurchaseBar('food-purchase-bar food-purchase-bar-mobile')}
  </div>
}
