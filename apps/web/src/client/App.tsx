'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { BrandLogo } from './design-system/BrandLogo'
import { Icon } from './design-system/Icon'
import { CartPage } from './features/cart/CartPage'
import { ContactPage } from './features/contact/ContactPage'
import { MenuPage } from './features/menu/MenuPage'
import { OrderSuccess } from './features/orders/OrderSuccess'
import { ProfilePage } from './features/profile/ProfilePage'
import { getTodayMenu, getTodayMenuCartSnapshot } from './services/menuApi'
import { getCustomerSession, loginCustomerWithTelegram } from './services/customerApi'
import { bindTelegramBackButton, getTelegramInitData } from './services/telegram'
import { loadStoredCart, saveStoredCart } from './services/cartStorage'
import { reconcileCart } from './services/cartReconciliation'
import type { CartItem, DailyMenuItemDto, OrderDto, PublicDailyMenuPageDto, PersianRiceDto } from './types'

type Page = 'menu' | 'cart' | 'profile' | 'contact' | 'success'

const initialPage = (): Page => {
  if (typeof window === 'undefined') return 'menu'
  return new URLSearchParams(window.location.search).get('page') === 'cart' ? 'cart' : 'menu'
}

function App() {
  const [page, setPage] = useState<Page>(initialPage)
  const [menu, setMenu] = useState<PublicDailyMenuPageDto | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartHydrated, setIsCartHydrated] = useState(false)
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [shouldScrollToCategories, setShouldScrollToCategories] = useState(false)
  const [cartMessages, setCartMessages] = useState<string[]>([])
  const [isCheckingCart, setIsCheckingCart] = useState(false)
  const [isCartVerified, setIsCartVerified] = useState(false)
  const [isCustomerAuthenticated, setIsCustomerAuthenticated] = useState(false)
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

  useEffect(() => {
    if (page !== 'menu' || !shouldScrollToCategories) return

    const animationFrame = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById('menu-categories')?.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
      setShouldScrollToCategories(false)
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [page, shouldScrollToCategories])

  // The same dish with and without the Persian upgrade are two independent cart lines.
  const addToCart = (item: DailyMenuItemDto, withPersianRice = false) => {
    setCartMessages([])
    setIsCartVerified(true)
    const rice = withPersianRice && item.allowsPersianRice ? menu?.persianRice ?? null : null
    const upgraded = rice != null
    updateCart((current) => {
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
      if (existing) {
        return current.map((cartItem) => sameLine(cartItem)
          ? { ...cartItem, ...refreshed, quantity: Math.min(cartItem.quantity + 1, remaining) }
          : cartItem)
      }
      return [...current, { dailyMenuItemId: item.id, ...refreshed, quantity: 1 }]
    })
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
    setPage('cart')
    void loadMenu(true)
  }

  const showCategories = () => {
    setShouldScrollToCategories(true)
    setPage('menu')
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
          <button className={`profile-button ${page === 'profile' ? 'active' : ''}`} onClick={() => setPage('profile')} aria-label="پروفایل و سفارش‌های من" aria-current={page === 'profile' ? 'page' : undefined}>
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
        <OrderSuccess order={order} onBack={() => { setOrder(null); setPage('menu') }} />
      )}
      {page === 'profile' && <ProfilePage onBack={() => setPage('menu')} onAuthenticationChange={setIsCustomerAuthenticated} />}
      {page === 'contact' && <ContactPage onBack={() => setPage('menu')} onAccount={() => setPage('profile')} />}

      {page !== 'success' && (
        <nav className="mobile-bottom-nav" aria-label="پیمایش اصلی">
          <button className={page === 'menu' ? 'active' : ''} onClick={() => setPage('menu')} aria-label="خانه" aria-current={page === 'menu' ? 'page' : undefined}>
            <Icon name="home" size="lg" />
            <span>خانه</span>
          </button>
          <button onClick={showCategories} aria-label="دسته‌ها">
            <Icon name="categories" size="lg" />
            <span>دسته‌ها</span>
          </button>
          <button className={page === 'cart' ? 'active' : ''} onClick={openCart} aria-label="سبد خرید" aria-current={page === 'cart' ? 'page' : undefined}>
            <span className="nav-icon-wrap"><Icon name="cart" size="lg" />{cart.length > 0 && <span className="nav-count">{cart.length}</span>}</span>
            <span>سبد خرید</span>
          </button>
          <button className={page === 'profile' ? 'active' : ''} onClick={() => setPage('profile')} aria-label={isCustomerAuthenticated ? 'حساب من' : 'ورود'} aria-current={page === 'profile' ? 'page' : undefined}>
            <Icon name="profile" size="lg" />
            <span>{isCustomerAuthenticated ? 'حساب من' : 'ورود'}</span>
          </button>
          <button className={page === 'contact' ? 'active' : ''} onClick={() => setPage('contact')} aria-label="تماس" aria-current={page === 'contact' ? 'page' : undefined}>
            <Icon name="phone" size="lg" />
            <span>تماس</span>
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
