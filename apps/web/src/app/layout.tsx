import type { Metadata } from 'next'
import Script from 'next/script'
import '../client/index.css'
import '../client/App.css'
import '../client/FoodDetailUx.css'
import '../client/ActiveOrderTracker.css'
import '../client/AppSplash.css'
import { ActiveOrderTracker } from '../client/ActiveOrderTracker'
import { AppSplash } from '../client/AppSplash'
import { CustomerAnalytics } from '../client/CustomerAnalytics'
import { splashSeenScript } from '../client/splash-session'

export const metadata: Metadata = {
  title: 'کفگیر | غذای خانگی',
  description: 'منوی روزانه غذای خانگی کفگیر در اندیمشک',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The Telegram Web App script runs before hydration and writes --tg-viewport-* onto <html>,
    // which the server never rendered. Without this, React fails hydration on every page load.
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Hides the splash before first paint when this session has already seen it. */}
        <script dangerouslySetInnerHTML={{ __html: splashSeenScript }} />
      </head>
      <body>
        <AppSplash />
        <CustomerAnalytics />
        {children}
        <ActiveOrderTracker />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
