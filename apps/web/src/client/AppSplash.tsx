'use client'

import { useEffect, useState } from 'react'
import { SPLASH_SEEN_CLASS, SPLASH_SEEN_KEY } from './splash-session'

/**
 * The brand on screen from the very first paint until the app can respond.
 *
 * It is part of the server HTML, so it shows before any script loads, and it leaves as soon as React
 * has hydrated — never on a timer — so a returning customer waits for nothing extra. Everything here
 * animates in CSS from the first frame, because on a fast connection the whole splash may last well
 * under a second. The layout keeps it mounted only once: in-app navigation does not bring it back. If
 * scripts never run, the CSS fallback in `AppSplash.css` still clears it.
 */
export function AppSplash() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown')
  useEffect(() => {
    try { sessionStorage.setItem(SPLASH_SEEN_KEY, '1') } catch { /* storage unavailable: show it each load */ }
    // Already shown this session: the head script hid it before paint, so drop it without a fade.
    if (document.documentElement.classList.contains(SPLASH_SEEN_CLASS)) {
      setPhase('gone')
      return
    }
    const frame = requestAnimationFrame(() => setPhase('leaving'))
    const timer = window.setTimeout(() => setPhase('gone'), 600)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])
  if (phase === 'gone') return null
  return <div className={`app-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="در حال آماده‌سازی کفگیر">
    <span className="app-splash-dots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
    <div className="app-splash-mark">
      <div className="app-splash-emblem">
        <span className="app-splash-steam" aria-hidden="true"><i /><i /><i /></span>
        <div className="app-splash-plate">
          <img src="/branding/logo.png" alt="" width={112} height={112} />
        </div>
      </div>
      <strong>کفگیر</strong>
      <svg className="app-splash-divider" viewBox="0 0 160 16" aria-hidden="true" focusable="false">
        <path d="M4 8h52M104 8h52" />
        <path className="divider-leaf" d="M62 8c4-6 10-7 14-4-3 5-9 6-14 4Z" />
        <path className="divider-leaf" d="M98 8c-4-6-10-7-14-4 3 5 9 6 14 4Z" />
        <circle cx="80" cy="8" r="3.2" />
      </svg>
      <span className="app-splash-slogan">غذای خونگی، با عشق</span>
    </div>
    <div className="app-splash-footer">
      <span className="app-splash-loader" aria-hidden="true"><i /><i /><i /></span>
      <span className="app-splash-hint">سفره‌ات را آماده می‌کنیم…</span>
    </div>
    <svg className="app-splash-sofreh" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 18 Q10 8 20 18 T40 18 T60 18 T80 18 T100 18 T120 18 T140 18 T160 18 T180 18 T200 18 T220 18 T240 18 T260 18 T280 18 T300 18 T320 18 T340 18 T360 18 T380 18 T400 18 V40 H0Z" />
    </svg>
  </div>
}
