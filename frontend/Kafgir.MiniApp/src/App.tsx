import { useEffect, useState } from 'react'
import './App.css'
import { BrandLogo } from './design-system/BrandLogo'
import { Icon } from './design-system/Icon'
import { CartPage } from './features/cart/CartPage'
import { MenuPage } from './features/menu/MenuPage'
import { OrderSuccess } from './features/orders/OrderSuccess'
import { getTodayMenu } from './services/menuApi'
import { bindTelegramBackButton } from './services/telegram'
import type { CartItem, DailyMenuDto, OrderDto } from './types'

type Page = 'menu' | 'cart' | 'success'
const cartStorageKey = 'kafgir.cart'

function loadStoredCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CartItem => {
      if (typeof item !== 'object' || item === null) return false
      const candidate = item as Partial<CartItem>
      return typeof candidate.dailyMenuItemId === 'number'
        && typeof candidate.foodName === 'string'
        && typeof candidate.unitPrice === 'number'
        && typeof candidate.quantity === 'number'
        && candidate.quantity > 0
        && typeof candidate.remainingPortions === 'number'
    })
  } catch {
    return []
  }
}

function App() {
  const [page, setPage] = useState<Page>('menu')
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
    localStorage.setItem(cartStorageKey, JSON.stringify(cart))
  }, [cart])

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
        <BrandLogo variant="horizontal" className="header-logo-desktop" />
        <BrandLogo variant="compact" className="header-logo-mobile" />
        {page === 'menu' && (
          <button className="cart-button" onClick={() => setPage('cart')} aria-label={`سبد خرید، ${cart.reduce((sum, item) => sum + item.quantity, 0)} قلم`}>
            <Icon name="cart" size="md" />
            <span className="cart-label">سبد خرید</span>
            <span className="cart-count" aria-live="polite">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </button>
        )}
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

      {page !== 'success' && (
        <nav className="mobile-bottom-nav" aria-label="پیمایش اصلی">
          <button className={page === 'menu' ? 'active' : ''} onClick={() => setPage('menu')} aria-current={page === 'menu' ? 'page' : undefined}>
            <Icon name="home" size="lg" /><span>منوی امروز</span>
          </button>
          <button onClick={showCategories}>
            <Icon name="categories" size="lg" /><span>دسته‌ها</span>
          </button>
          <button className={page === 'cart' ? 'active' : ''} onClick={() => setPage('cart')} aria-current={page === 'cart' ? 'page' : undefined}>
            <span className="nav-icon-wrap"><Icon name="cart" size="lg" />{cart.length > 0 && <span className="nav-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}</span>
            <span>سبد خرید</span>
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
