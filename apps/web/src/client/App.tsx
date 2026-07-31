'use client'

import { useEffect, useState } from 'react'
import './App.css'
import { BrandLogo } from './design-system/BrandLogo'
import { Icon } from './design-system/Icon'
import { CartPage } from './features/cart/CartPage'
import { ContactPage } from './features/contact/ContactPage'
import { MenuPage } from './features/menu/MenuPage'
import { OrderSuccess } from './features/orders/OrderSuccess'
import { ProfilePage } from './features/profile/ProfilePage'
import { getTodayMenu } from './services/menuApi'
import { bindTelegramBackButton } from './services/telegram'
import { loadStoredCart, saveStoredCart } from './services/cartStorage'
import type { CartItem, DailyMenuDto, OrderDto } from './types'

type Page = 'menu' | 'cart' | 'profile' | 'contact' | 'success'

const initialPage = (): Page => {
  if (typeof window === 'undefined') return 'menu'
  return new URLSearchParams(window.location.search).get('page') === 'cart' ? 'cart' : 'menu'
}

function App() {
  const [page, setPage] = useState<Page>(initialPage)
  const [menu, setMenu] = useState<DailyMenuDto | null>(null)
  const [cart, setCart] = useState<CartItem[]>(loadStoredCart)
  const [order, setOrder] = useState<OrderDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [shouldScrollToCategories, setShouldScrollToCategories] = useState(false)

  const loadMenu = async () => {
    setIsLoading(true)
    setMenuError(null)
    try {
      const latestMenu = await getTodayMenu()
      setMenu(latestMenu)
      if (!latestMenu) {
        setCart([])
      } else {
        const latestItems = new Map(latestMenu.items.map((item) => [item.id, item]))
        setCart((current) => current.flatMap((cartItem) => {
          const latestItem = latestItems.get(cartItem.dailyMenuItemId)
          if (!latestMenu.isOpen || !latestItem?.isAvailable || latestItem.remainingPortions <= 0) return []
          return [{
            ...cartItem,
            foodName: latestItem.foodName,
            unitPrice: latestItem.price,
            remainingPortions: latestItem.remainingPortions,
            quantity: Math.min(cartItem.quantity, latestItem.remainingPortions),
          }]
        }))
      }
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'دریافت منوی امروز ناموفق بود.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadMenu() }, [])

  useEffect(() => {
    saveStoredCart(cart)
  }, [cart])

  useEffect(() => {
    const syncStoredCart = () => setCart(loadStoredCart())
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
  }, [])

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

  const addToCart = (item: DailyMenuDto['items'][number]) => {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.dailyMenuItemId === item.id)
      if (existing) {
        return current.map((cartItem) => cartItem.dailyMenuItemId === item.id
          ? { ...cartItem, quantity: Math.min(cartItem.quantity + 1, cartItem.remainingPortions) }
          : cartItem)
      }
      return [...current, {
        dailyMenuItemId: item.id,
        foodName: item.foodName,
        unitPrice: item.price,
        quantity: 1,
        remainingPortions: item.remainingPortions,
      }]
    })
  }

  const updateQuantity = (id: number, quantity: number) => {
    setCart((current) => current
      .map((item) => item.dailyMenuItemId === id
        ? { ...item, quantity: Math.min(quantity, item.remainingPortions) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  const handleSuccess = (createdOrder: OrderDto) => {
    setOrder(createdOrder)
    setCart([])
    setPage('success')
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
            <Icon name="profile" size="md" /><span>ورود</span>
          </button>
          <button className={`profile-button ${page === 'contact' ? 'active' : ''}`} onClick={() => setPage('contact')} aria-label="تماس با کفگیر" aria-current={page === 'contact' ? 'page' : undefined}>
            <Icon name="support" size="md" /><span>تماس با ما</span>
          </button>
          {page === 'menu' && (
          <button className="cart-button" onClick={() => setPage('cart')} aria-label={`سبد خرید، ${cart.length} قلم`}>
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
        <CartPage items={cart} onQuantityChange={updateQuantity}
          onBack={() => setPage('menu')} onSuccess={handleSuccess} />
      )}
      {page === 'success' && order && (
        <OrderSuccess order={order} onBack={() => { setOrder(null); setPage('menu') }} />
      )}
      {page === 'profile' && <ProfilePage onBack={() => setPage('menu')} />}
      {page === 'contact' && <ContactPage onBack={() => setPage('menu')} />}

      {page !== 'success' && (
        <nav className="mobile-bottom-nav" aria-label="پیمایش اصلی">
          <button className={page === 'menu' ? 'active' : ''} onClick={() => setPage('menu')} aria-label="منوی امروز" aria-current={page === 'menu' ? 'page' : undefined}>
            <Icon name="home" size="lg" />
            <span>منوی امروز</span>
          </button>
          <button onClick={showCategories} aria-label="دسته‌ها">
            <Icon name="categories" size="lg" />
            <span>دسته‌ها</span>
          </button>
          <button className={page === 'cart' ? 'active' : ''} onClick={() => setPage('cart')} aria-label="سبد خرید" aria-current={page === 'cart' ? 'page' : undefined}>
            <span className="nav-icon-wrap"><Icon name="cart" size="lg" />{cart.length > 0 && <span className="nav-count">{cart.length}</span>}</span>
            <span>سبد خرید</span>
          </button>
          <button className={page === 'profile' ? 'active' : ''} onClick={() => setPage('profile')} aria-label="ورود" aria-current={page === 'profile' ? 'page' : undefined}>
            <Icon name="profile" size="lg" />
            <span>ورود</span>
          </button>
          <button className={page === 'contact' ? 'active' : ''} onClick={() => setPage('contact')} aria-label="تماس" aria-current={page === 'contact' ? 'page' : undefined}>
            <Icon name="support" size="lg" />
            <span>تماس</span>
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
