type TelegramUser = { id?: number; username?: string }
type TelegramBackButton = {
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}
type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: { user?: TelegramUser }
  BackButton?: TelegramBackButton
  ready: () => void
  expand: () => void
}
type TelegramWindow = Window & { Telegram?: { WebApp?: TelegramWebApp } }

const getWebApp = () => (window as TelegramWindow).Telegram?.WebApp

export function initializeTelegramMiniApp(): void {
  const webApp = getWebApp()
  if (!webApp) return

  webApp.ready()
  webApp.expand()
}

export function bindTelegramBackButton(onBack: (() => void) | null): () => void {
  const backButton = getWebApp()?.BackButton
  if (!backButton) return () => undefined

  if (!onBack) {
    backButton.hide()
    return () => undefined
  }

  backButton.onClick(onBack)
  backButton.show()
  return () => {
    backButton.offClick(onBack)
    backButton.hide()
  }
}

export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null
}

export function getTelegramInitData(): string | null {
  return getWebApp()?.initData || null
}
