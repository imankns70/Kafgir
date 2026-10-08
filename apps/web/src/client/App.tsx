'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { BrandLogo } from './design-system/BrandLogo'
import { Icon } from './design-system/Icon'
import { CartPage } from './features/cart/CartPage'
import { CartAddedToast, type CartAddition } from "./features/cart/CartAddedToast"
import { ContactPage } from './features/contact/ContactPage'
import { MenuPage } from './features/menu/MenuPage'
import { MenuPlanPage } from './features/menu/MenuPlanPage'
import { OrderSuccess } from './features/orders/OrderSuccess'
import { PostDeliveryReviewPrompt } from './features/orders/PostDeliveryReviewPrompt'
import { ProfilePage, type AccountSection } from './features/profile/ProfilePage'
import { getTodayMenu, getTodayMenuCartSnapshot } from './services/menuApi'
import { getCustomerSession, loginCustomerWithTelegram } from './services/customerApi'
import { bindTelegramBackButton, getTelegramInitData } from './services/telegram'
import { loadStoredCart, saveStoredCart } from './services/cartStorage'
import { reconcileCart } from './services/cartReconciliation'
import type { CartItem, DailyMenuItemDto, OrderDto, PublicDailyMenuPageDto, PersianRiceDto } from './types'

type Page = 'menu' | 'plan' | 'cart' | 'profile' | 'contact' | 'success'

const requestedPage = () => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('page')

const initialPage = (): Page => {
  const requested = requestedPage()
  if (requested === 'cart') return 'cart'
  // Links from outside the app shell (the active-order sheet on a food page) land on these.
  if (requested === 'orders') return 'profile'
  if (requested === 'contact') return 'contact'
  return 'menu'
}

function App() {
  const [page, setPage] = useState<Page>(initialPage)
  const [profileSection, setProfileSection] = useState<AccountSection>(() => requestedPage() === 'orders' ? 'orders' : 'home')
  // Bumped on every explicit visit so the account remounts on the requested section.
  const [profileVisit, setProfileVisit] = useState(0)
  const openAccount = () => { setProfileSection('home'); setProfileVisit((visit) => visit + 1); setPage('profile') }
  const [menu, setMenu] = useState<PublicDailyMenuPageDto | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartHydrated, setIsCartHydrated] = useState(false)
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [cartMessages, setCartMessages] = useState<string[]>([])
  const [isCheckingCart, setIsCheckingCart] = useState(false)
  const [isCartVerified, setIsCartVerified] = useState(false)
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false)
  const [cartAddition, setCartAddition] = useState<CartAddition | null>(null)
  const cartRef = useRef(cart)

  const updateCart = useCallback((updater: CartItem[] | ((current: CartItem[]) => CartItem[])) => {
    setCart((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      cartRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    const storedCart = loadStoredCart()
    cartRef.current = storedCart
    setCart(storedCart)
    setIsCartHydrated(true)
  }, [])

  const loadMenu = async (forCart = false, background = false) => {
    if (forCart) setIsCheckingCart(true)
    else if (!background) setIsLoading(true)
    if (!background) {
      setIsCartVerified(false)
      setMenuError(null)
    }
    try {
      const latestMenu = await getTodayMenu({ limit: 12 })
      setMenu(latestMenu)
      const cartSnapshot = cartRef.current.length > 0
        ? await getTodayMenuCartSnapshot(cartRef.current.map((item) => ({
            dailyMenuItemId: item.dailyMenuItemId, foodId: item.foodId, foodName: item.foodName,
            withPersianRice: Boolean(item.withPersianRice),
          })))
        : latestMenu ? { isOpen: latestMenu.isOpen, items: [], persianRice: latestMenu.persianRice } : null
      const reconciled = reconcileCart(cartRef.current, cartSnapshot)
      updateCart(reconciled.items)
      setCartMessages(reconciled.messages)
      setIsCartVerified(true)
    } catch (error) {
      if (!background) {
        setMenuError(error instanceof Error ? error.message : 'دریافت منوی امروز ناموفق بود.')
        setCartMessages(['بررسی موجودی سبد ممکن نشد؛ اتصال را بررسی و دوباره تلاش کنید.'])
      }
    } finally {
      if (forCart) setIsCheckingCart(false)
      else setIsLoading(false)
    }
  }

  useEffect(() => { void loadMenu() }, [])

  // The active-order sheet lives outside this component; it asks for a page with a cancelable event
  // and falls back to a full navigation when nothing handled it.
  useEffect(() => {
    const navigate = (event: Event) => {
      const target = (event as CustomEvent<string>).detail
      if (target === 'orders') { event.preventDefault(); setProfileSection('orders'); setProfileVisit((visit) => visit + 1); setPage('profile') }
      if (target === 'contact') { event.preventDefault(); setPage('contact') }
    }
    window.addEventListener('kafgir:navigate', navigate)
    return () => window.removeEventListener('kafgir:navigate', navigate)
  }, [])

  useEffect(() => {
    let isActive = true
    const checkSession = async () => {
      try {
        let session = await getCustomerSession()
        const initData = getTelegramInitData()
        if (!session.authenticated && initData) session = await loginCustomerWithTelegram(initData)
        if (isActive) setIsCustomerAuthenticated(session.authenticated)
      } catch {
        if (isActive) setIsCustomerAuthenticated(false)
      }
    }
    void checkSession()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    const refreshCartSnapshot = async () => {
      if (document.visibilityState !== 'visible' || cartRef.current.length === 0) return
      try {
        const snapshot = await getTodayMenuCartSnapshot(cartRef.current.map((item) => ({
          dailyMenuItemId: item.dailyMenuItemId, foodId: item.foodId, foodName: item.foodName,
          withPersianRice: Boolean(item.withPersianRice),
        })))
        const reconciled = reconcileCart(cartRef.current, snapshot)
        updateCart(reconciled.items)
        setCartMessages(reconciled.messages)
        setIsCartVerified(true)
      } catch {
        // Background validation remains quiet; opening the cart performs an explicit retry.
      }
    }
    const interval = window.setInterval(() => void refreshCartSnapshot(), 15_000)
    window.addEventListener('focus', refreshCartSnapshot)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshCartSnapshot)
    }
  }, [updateCart])

  useEffect(() => {
    if (isCartHydrated) saveStoredCart(cart)
  }, [cart, isCartHydrated])

  useEffect(() => {
    const syncStoredCart = () => updateCart(loadStoredCart())
    const syncVisibleCart = () => {
      if (document.visibilityState === 'visible') syncStoredCart()
    }
    window.addEventListener('pageshow', syncStoredCart)
    window.addEventListener('focus', syncStoredCart)
    document.addEventListener('visibilitychange', syncVisibleCart)
    return () => {
      window.removeEventListener('pageshow', syncStoredCart)
      window.removeEventListener('focus', syncStoredCart)
      document.removeEventListener('visibilitychange', syncVisibleCart)
    }
  }, [updateCart])

  useEffect(() => bindTelegramBackButton(page === 'menu'
    ? null
    : () => {
        if (page === 'success') setOrder(null)
        setPage('menu')
      }), [page])

  // The same dish with and without the Persian upgrade are two independent cart lines.
  const addToCart = (item: DailyMenuItemDto, withPersianRice = false) => {
    setCartMessages([])
    setIsCartVerified(true)
    const rice = withPersianRice && item.allowsPersianRice ? menu?.persianRice ?? null : null
    const upgraded = rice != null
    {
      const current = cartRef.current
      const remaining = upgraded
        ? Math.min(item.remainingPortions, rice.remainingPortions)
        : item.remainingPortions
      const originalUnitPrice = item.originalPrice ?? null
      const sameLine = (cartItem: CartItem) =>
        cartItem.dailyMenuItemId === item.id && Boolean(cartItem.withPersianRice) === upgraded
      const refreshed = {
        foodId: item.foodId,
        slug: item.slug,
        foodName: item.foodName,
        imageUrl: item.imageUrl ?? null,
        withPersianRice: upgraded,
        persianRiceTitle: rice?.title ?? null,
        persianRicePrice: rice?.price ?? 0,
        unitPrice: item.price,
        originalUnitPrice,
        discountPercentage: originalUnitPrice ? Math.round((1 - item.price / originalUnitPrice) * 100) : null,
        remainingPortions: remaining,
        availability: 'available' as const,
        availabilityMessage: null,
      }
      const existing = current.find(sameLine)
      const next = existing
        ? current.map((cartItem) => sameLine(cartItem)
          ? { ...cartItem, ...refreshed, quantity: Math.min(cartItem.quantity + 1, remaining) }
          : cartItem)
        : [...current, { dailyMenuItemId: item.id, ...refreshed, quantity: 1 }]
      updateCart(next)
      // Confirm the add where the customer is looking, rather than leaving them to check the cart
      // badge in the header.
      const line = next.find(sameLine)
      if (line) {
        setCartAddition({
          key: Date.now(),
          foodName: item.foodName,
          imageUrl: item.imageUrl ?? null,
          withPersianRice: upgraded,
          quantity: line.quantity,
          lineTotal: (line.unitPrice + (line.persianRicePrice ?? 0)) * line.quantity,
          cartCount: next.length,
        })
      }
    }
  }

  const updateQuantity = (id: number, quantity: number, withPersianRice = false) => {
    setCartMessages([])
    updateCart((current) => current
      .map((item) => item.dailyMenuItemId === id && Boolean(item.withPersianRice) === withPersianRice
        ? { ...item, quantity: Math.min(quantity, item.remainingPortions) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  const handleSuccess = (createdOrder: OrderDto) => {
    setOrder(createdOrder)
    updateCart([])
    setCartMessages([])
    setPage('success')
  }

  const openCart = () => {
    setCartAddition(null)
    setPage('cart')
    void loadMenu(true)
  }

  return (
    <div className="app-shell" dir="rtl">
      <header className="app-header">
        <button className="brand-home-link header-logo-desktop" onClick={() => setPage('menu')} aria-label="بازگشت به صفحه اصلی کفگیر">
          <BrandLogo variant="horizontal" />
        </button>
        <button className="brand-home-link header-logo-mobile" onClick={() => setPage('menu')} aria-label="بازگشت به صفحه اصلی کفگیر">
          <BrandLogo variant="compact" />
        </button>
        <div className="header-actions">
          <button className={`profile-button ${page === 'profile' ? 'active' : ''}`} onClick={openAccount} aria-label="پروفایل و سفارش‌های من" aria-current={page === 'profile' ? 'page' : undefined}>
            <Icon name="profile" size="md" /><span>{isCustomerAuthenticated ? 'حساب من' : 'ورود'}</span>
          </button>
          <button className={`profile-button ${page === 'contact' ? 'active' : ''}`} onClick={() => setPage('contact')} aria-label="تماس با کفگیر" aria-current={page === 'contact' ? 'page' : undefined}>
            <Icon name="phone" size="md" /><span>تماس با ما</span>
          </button>
          {page === 'menu' && (
          <button className="cart-button" onClick={openCart} aria-label={`سبد خرید، ${cart.length} قلم`}>
            <Icon name="cart" size="md" />
            <span className="cart-label">سبد خرید</span>
            <span className="cart-count" aria-live="polite">{cart.length}</span>
          </button>
          )}
        </div>
      </header>

      {page === 'menu' && (
        <MenuPage menu={menu} isLoading={isLoading} error={menuError}
          cartItems={cart} onRetry={loadMenu} onAdd={addToCart} onQuantityChange={updateQuantity} />
      )}
      {page === 'cart' && (
        <CartPage items={cart} messages={cartMessages} isChecking={isCheckingCart || isLoading}
          isVerified={isCartVerified} onRefresh={() => void loadMenu(true)} onQuantityChange={updateQuantity}
          onBack={() => setPage('menu')} onSuccess={handleSuccess}
          onAuthenticationChange={setIsCustomerAuthenticated} />
      )}
      {page === 'success' && order && (
        <OrderSuccess order={order} onBack={() => { setOrder(null); setPage('menu') }} onTrack={() => { setOrder(null); setProfileSection('orders'); setPage('profile') }} />
      )}
      {page === 'plan' && <MenuPlanPage onBack={() => setPage('menu')} onOpenToday={() => setPage('menu')} />}
      {page === 'profile' && <ProfilePage key={`${profileSection}-${profileVisit}`} initialSection={profileSection} onBack={() => setPage('menu')} onContact={() => setPage('contact')} onAuthenticationChange={setIsCustomerAuthenticated} />}
      {page === 'contact' && <ContactPage onBack={() => setPage('menu')} onAccount={openAccount} />}

      {page !== 'success' && (
        <nav className="mobile-bottom-nav" aria-label="پیمایش اصلی">
          <button className={page === 'menu' ? 'active' : ''} onClick={() => setPage('menu')} aria-label="خانه" aria-current={page === 'menu' ? 'page' : undefined}>
            <Icon name="home" size="lg" />
            <span>خانه</span>
          </button>
          {/* Order history already lives inside «حساب من», so the tab is spent on the one thing the
              app cannot show anywhere else: what is being cooked on the days ahead. */}
          <button className={page === 'plan' ? 'active' : ''} onClick={() => setPage('plan')} aria-label="برنامه ماه"
            aria-current={page === 'plan' ? 'page' : undefined}>
            <Icon name="calendar" size="lg" />
            <span>برنامه ماه</span>
          </button>
          <button className={page === 'cart' ? 'active' : ''} onClick={openCart} aria-label="سبد خرید" aria-current={page === 'cart' ? 'page' : undefined}>
            <span className="nav-icon-wrap"><Icon name="cart" size="lg" />{cart.length > 0 && <span className="nav-count">{cart.length}</span>}</span>
            <span>سبد خرید</span>
          </button>
          <button className={page === 'profile' ? 'active' : ''} onClick={openAccount} aria-label={isCustomerAuthenticated ? 'حساب من' : 'ورود'} aria-current={page === 'profile' ? 'page' : undefined}>
            <Icon name="profile" size="lg" />
            <span>{isCustomerAuthenticated ? 'حساب من' : 'ورود'}</span>
          </button>
          <button className={page === 'contact' ? 'active' : ''} onClick={() => setPage('contact')} aria-label="تماس" aria-current={page === 'contact' ? 'page' : undefined}>
            <Icon name="phone" size="lg" />
            <span>تماس</span>
          </button>
        </nav>
      )}
      {/* App-wide: a delivered order should surface wherever the customer happens to be. */}
      <CartAddedToast addition={page === 'menu' ? cartAddition : null} onOpenCart={openCart} onDismiss={() => setCartAddition(null)} />
      <PostDeliveryReviewPrompt isAuthenticated={isCustomerAuthenticated} />
    </div>
  )
}

export default App
